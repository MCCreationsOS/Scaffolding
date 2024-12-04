import { ObjectId } from "mongodb";

import { getIdFromJWT, getUserFromJWT } from "../../auth/routes.js";
import { ContentDocument, DatabaseCollection, SearchIndex } from "../../db/types.js";
import { app } from "../../index.js";
import { findContent, performSearch } from "../searching.js";
import { UserTypes } from "../../auth/types.js";
import { Database } from "../../db/connect.js";

export function initializeMarketplaceRoutes() {
	app.get('/marketplace-nosearch', async (req, res) => {
		let result = await findContent(DatabaseCollection.Marketplace, req.query, false)
		let user = await getUserFromJWT(req.headers.authorization + "")

		result.documents = result.documents.filter((content: ContentDocument) => {
			if(content.status < 2) {
				if(user.user && content.creators) {
					if(user.user.type === UserTypes.Admin) return true;
					for(const creator of content.creators) {
						if(creator.handle === user.user.handle) return true;
					}
				} else if(user.user && content.owner && content.owner === user.user.handle) {
                    return true;
                } else {
					let id = getIdFromJWT(req.headers.authorization + "") as ObjectId
					if(id && id instanceof ObjectId && id.equals(content._id)) {
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

    app.get('/marketplace/:slug', async (req, res) => {
        let result = await findContent(DatabaseCollection.Marketplace, {limit: 1, slug: req.params.slug}, false)

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
					let id = getIdFromJWT(req.headers.authorization) as ObjectId
					if(id && id instanceof ObjectId && id.equals(result.documents[0]._id)) {
						filter = false;
					}
				}
			}
			if(filter) {
				res.send({error: "Marketplace item does not exist, or you do not have permission to view it"})
				return;
			}
		}

		if(result.documents.length !== 1) {
			res.send({error: "Marketplace item does not exist, or you do not have permission to view it"})
			return;
		}
        res.send(result.documents[0])
    })

	app.get('/marketplace/:slug/download', async (req, res) => {
        let result = await findContent(DatabaseCollection.Marketplace, {limit: "1", slug: req.params.slug}, false)

        if(result.documents[0]) {
            let marketplace = result.documents[0]

            let database = new Database("content", DatabaseCollection.Marketplace);
            database.collection.updateOne({_id: marketplace._id}, {$inc: {downloads: 1}})
			res.sendStatus(200)
			return
        }
		res.sendStatus(404)
    })

	app.get('/marketplace/:slug/comments', async (req, res) => {
		let result = await findContent(DatabaseCollection.Marketplace, {limit: 1, slug: req.params.slug}, false)

        if(result.documents[0]) {
            let marketplace = result.documents[0]
			res.send({comments: marketplace.comments})
			return;
		}
		res.sendStatus(404)
	})

	app.get('/marketplace/:slug/stats', async (req, res) => {
		let result = await findContent(DatabaseCollection.Marketplace, {limit: 1, slug: req.params.slug}, false)

        if(result.documents[0]) {
            let marketplace = result.documents[0]
			res.send({downloads: marketplace.downloads, ratings: marketplace.ratings, rating: marketplace.rating, views: marketplace.views})
			return;
		}
		res.sendStatus(404)
	})

    // TODO: Needs more work
	app.get('/tags/marketplace', async (req, res) => {
		res.send({
			genre: [
				"realistic",
                "simple",
                "themed",
                "utility",
                "other"
			],
			subgenre: [
				"cartoon",
                "smooth",
                "faithful",
                "other",
                "PVP",
                "entities",
                "items",
                "blocks",
                "GUI",
                "font",
                "sound",
                "music",
                "language",
                "weapons",
                "funny",
                "cosmetic",
                "models",
                "shaders",
                "skybox",
			],
			resolution: [
				"8x",
                "16x",
                "32x",
                "64x",
                "128x",
                "256x",
                "512x",
                "1024x +",
			],
			theme: [
				"medieval",
				"modern",
				"fantasy",
				"sci-fi",
				"realistic",
				"vanilla",
                "anime"
			],

		})
	})
}