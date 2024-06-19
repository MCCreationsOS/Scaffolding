import { ObjectId } from "mongodb";

import { getIdFromJWT, getUserFromJWT } from "../../auth/routes.js";
import { ContentDocument, DatabaseCollection, SearchIndex } from "../../db/types.js";
import { app } from "../../index.js";
import { findContent, performSearch } from "../searching.js";
import { UserTypes } from "../../auth/types.js";
import { Database } from "../../db/connect.js";

export function initializeDatapackRoutes() {
    app.get('/datapacks', async (req, res) => {
        let result = await performSearch(SearchIndex.Datapacks, req.query)
		let user = await getUserFromJWT(req.headers.authorization + "")

		result.documents = result.documents.filter((datapack: ContentDocument) => {
			if(datapack.status < 2) {
				if(user.user && datapack.creators) {
					for(const creator of datapack.creators) {
						if(creator.handle === user.user.handle) return true;
					}
				} else {
					let id = getIdFromJWT(req.headers.authorization + "") as ObjectId
					if(id && id instanceof ObjectId && id.equals(datapack._id)) {
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

    app.get('/datapacks/:slug', async (req, res) => {
        let result = await findContent(DatabaseCollection.Datapacks, {limit: 1, slug: req.params.slug}, false)

		if(result.documents[0] && result.documents[0].status < 1) {
			let filter = true;
			if(req.headers.authorization) {
				let uObj = await getUserFromJWT(req.headers.authorization)
				if(uObj.user && result.documents[0].creators) {
					for(const creator of result.documents[0].creators) {
						if(creator.handle === uObj.user.handle) filter = false;
					}
					if(uObj.user.type === UserTypes.Admin) filter = false;
				} else {
					let id = getIdFromJWT(req.headers.authorization) as ObjectId
					if(id && id instanceof ObjectId && id.equals(result.documents[0]._id)) {
						filter = false;
					}
				}
			}
			if(filter) {
				res.send({error: "Datapack does not exist, or you do not have permission to view it"})
				return;
			}
		}

		if(result.documents.length !== 1) {
			res.send({error: "Datapack does not exist, or you do not have permission to view it"})
			return;
		}
        res.send(result.documents[0])
    })

	app.get('/datapacks/:slug/download', async (req, res) => {
        let result = await findContent(DatabaseCollection.Datapacks, {limit: 1, slug: req.params.slug}, false)

        if(result.documents[0]) {
            let datapack = result.documents[0]

            let database = new Database();
            database.collection.updateOne({_id: datapack._id}, {$inc: {downloads: 1}})
			res.sendStatus(200)
			return
        }
		res.sendStatus(404)
    })

	app.get('/datapacks/:slug/comments', async (req, res) => {
		let result = await findContent(DatabaseCollection.Datapacks, {limit: 1, slug: req.params.slug}, false)

        if(result.documents[0]) {
            let datapack = result.documents[0]
			res.send({comments: datapack.comments})
			return;
		}
		res.sendStatus(404)
	})

	app.get('/datapacks/:slug/stats', async (req, res) => {
		let result = await findContent(DatabaseCollection.Datapacks, {limit: 1, slug: req.params.slug}, false)

        if(result.documents[0]) {
            let datapack = result.documents[0]
			res.send({downloads: datapack.downloads, ratings: datapack.ratings, rating: datapack.rating, views: datapack.views})
			return;
		}
		res.sendStatus(404)
	})

    // TODO: Needs more work
	app.get('/get_datapack_tags', async (req, res) => {
		res.send({
			genre: [
				"adventure",
				"survival",
				"game",
			],
			subgenre: [
				"horror",
				"PVE",
				"PVP",
				"challenge",
				"RPG",
				"unfair",
				"multiplayer",
				"singleplayer"
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