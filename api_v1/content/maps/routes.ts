import { app } from '../../index.js'
import { Database, DatabaseQueryBuilder, Search } from '../../db/connect.js';
import { getIdFromJWT, getUserFromJWT } from '../../auth/routes.js';
import { DatabaseCollection, ContentDocument as MapDoc, SearchIndex } from '../../db/types.js';
import { ObjectId } from 'mongodb';
import { sendLog } from '../../logging/logging.js';
import { UserTypes } from '../../auth/types.js';
import { findContent, performSearch } from '../searching.js';

export function initializeMapRoutes() {
	app.get('/maps-nosearch', async (req, res) => {
		let result = await findContent(DatabaseCollection.Maps, req.query, false)
		let user = await getUserFromJWT(req.headers.authorization + "")

		result.documents = result.documents.filter((map: MapDoc) => {
			if(map.status < 2) {
				if(user.user && map.creators) {
					if(user.user.type === UserTypes.Admin) return true;
					for(const creator of map.creators) {
						if(creator.handle === user.user.handle) return true;
					}
				} else if(user.user && map.owner && map.owner === user.user.handle) {
                    return true;
                } else {
					let id = getIdFromJWT(req.headers.authorization + "") as ObjectId
					if(id && id instanceof ObjectId && id.equals(map._id)) {
						return true;
					}
				}
				return false;
			}
			return true;
		})

        if(req.query.sendCount && req.query.sendCount === "true") {
            res.send({count: result.totalCount})
        } else {
            res.send(result);
        }
	})

    app.get('/maps/:slug', async (req, res) => {
        let result = await findContent(DatabaseCollection.Maps, {limit: 1, slug: req.params.slug}, false)

		if(result.documents[0] && result.documents[0].status < 1) {
			let filter = true;
			if(req.headers.authorization) {
				let uObj = await getUserFromJWT(req.headers.authorization)
				if(uObj.user && result.documents[0].creators) {
					for(const creator of result.documents[0].creators) {
						if(creator.handle === uObj.user.handle) filter = false;
					}
					if(uObj.user.type === UserTypes.Admin) filter = false;
				} else if(uObj.user && result.documents[0].owner && result.documents[0].owner === uObj.user.handle) {
                    return true;
                } else {
					if(uObj.user?.type === UserTypes.Admin) filter = false;
					let id = getIdFromJWT(req.headers.authorization) as ObjectId
					console.log(id)
					if(id && id instanceof ObjectId && id.equals(result.documents[0]._id)) {
						filter = false;
					}
				}
			}
			if(filter) {
				res.send({error: "Map does not exist, or you do not have permission to view it"})
				return;
			}
		}

		if(result.documents.length !== 1) {
			res.send({error: "Map does not exist, or you do not have permission to view it"})
			return;
		}
        res.send(result.documents[0])
    })

	app.get('/maps/:slug/download', async (req, res) => {
        let result = await findContent(DatabaseCollection.Maps, {limit: 1, slug: req.params.slug}, false)

        if(result.documents[0]) {
            let map = result.documents[0]

			// fetch()

            let database = new Database();
            database.collection.findOneAndUpdate({_id: new ObjectId(map._id)}, {$inc: {downloads: 1}})
			res.sendStatus(200)
			return
        }
		res.sendStatus(404)
    })

	app.get('/maps/:slug/comments', async (req, res) => {
		let result = await findContent(DatabaseCollection.Maps, {limit: 1, slug: req.params.slug}, false)

        if(result.documents[0]) {
            let map = result.documents[0]
			res.send({comments: map.comments})
			return;
		}
		res.sendStatus(404)
	})

	app.get('/maps/:slug/stats', async (req, res) => {
		let result = await findContent(DatabaseCollection.Maps, {limit: 1, slug: req.params.slug}, false)

        if(result.documents[0]) {
            let map = result.documents[0]
			res.send({downloads: map.downloads, ratings: map.ratings, rating: map.rating, views: map.views})
			return;
		}
		res.sendStatus(404)
	})

	app.get('/tags/maps', async (req, res) => {
		res.send({
			genre: [
				"adventure",
				"parkour",
				"survival",
				"puzzle",
				"game",
				"build"
			],
			subgenre: [
				"horror",
				"PVE",
				"PVP",
				"episodic",
				"challenge",
				'CTM',
				"RPG",
				"trivia",
				"escape",
				"finding",
				"maze",
				"unfair",
				"dropper",
				"elytra",
				"city",
				"park",
				"multiplayer",
				"singleplayer",
				"co-op"
			],
			difficulty: [
				"chill",
				"easy",
				"normal",
				"hard",
				"hardcore"
			],
			theme: [
				"medieval",
				"modern",
				"fantasy",
				"sci-fi",
				"realistic",
				"vanilla"
			],
			length: [
				"short",
				"medium",
				"long"
			],

		})
	})
}

