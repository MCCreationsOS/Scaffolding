import QueryString from 'qs';
import { app } from '../index.js'
import { Database, DatabaseQueryBuilder, Search } from '../db/connect.js';
import { getIdFromJWT, getUserFromJWT } from '../auth/routes.js';
import { MapDoc } from '../db/types.js';
import { ObjectId } from 'mongodb';
import { sendLog } from '../logging/logging.js';

export function initializeMapRoutes() {
    app.get('/maps', async (req, res) => {
        let result = await performSearch(req.query)
		let user = await getUserFromJWT(req.headers.authorization + "")

		result.documents = result.documents.filter((map: MapDoc) => {
			if(map.status < 2) {
				if(user.user && map.creators) {
					for(const creator of map.creators) {
						if(creator.handle === user.user.handle) return true;
					}
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

	app.get('/old/maps', async (req, res) => {
		let result = await findMaps(req.query, false)
		let user = await getUserFromJWT(req.headers.authorization + "")

		result.documents = result.documents.filter((map: MapDoc) => {
			if(map.status < 2) {
				if(user.user && map.creators) {
					for(const creator of map.creators) {
						if(creator.handle === user.user.handle) return true;
					}
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
        let result = await findMaps({limit: 1, slug: req.params.slug}, false)

		if(result.documents[0] && result.documents[0].status < 1) {
			let filter = true;
			if(req.headers.authorization) {
				let uObj = await getUserFromJWT(req.headers.authorization)
				if(uObj.user && result.documents[0].creators) {
					for(const creator of result.documents[0].creators) {
						if(creator.handle === uObj.user.handle) filter = false;
					}
					if(uObj.user.handle === "crazycowmm") filter = false;
				} else {
					let id = getIdFromJWT(req.headers.authorization) as ObjectId
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
        let result = await findMaps({limit: 1, slug: req.params.slug}, false)

        if(result.documents[0]) {
            let map = result.documents[0]

            let database = new Database();
            database.collection.updateOne({_id: map._id}, {$inc: {downloads: 1}})
			res.sendStatus(200)
			return
        }
		res.sendStatus(404)
    })

	app.get('/maps/:slug/comments', async (req, res) => {
		let result = await findMaps({limit: 1, slug: req.params.slug}, false)

        if(result.documents[0]) {
            let map = result.documents[0]
			res.send({comments: map.comments})
			return;
		}
		res.sendStatus(404)
	})

	app.get('/maps/:slug/stats', async (req, res) => {
		let result = await findMaps({limit: 1, slug: req.params.slug}, false)

        if(result.documents[0]) {
            let map = result.documents[0]
			res.send({downloads: map.downloads, ratings: map.ratings, rating: map.rating, views: map.views})
			return;
		}
		res.sendStatus(404)
	})

	app.get('/get_map_tags', async (req, res) => {
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
				"hard"
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

export async function findMaps(requestQuery: any, useProjection: boolean) {
    let database = new Database();
    let query = new DatabaseQueryBuilder();

	switch(requestQuery.sort) {
		case "newest":
			query.buildSort("createdDate", -1)
			break;
		case "updated":
            query.buildSort("updatedDate", -1)
			break;
		case "title_ascending": 
            query.buildSort("title", 1)
			break;
		case "title_descending":
            query.buildSort("title", -1)
			break;
		case "oldest":
            query.buildSort("createdDate", 1)
			break;
		case "highest_rated": 
            query.buildSort("rating", -1)
			break;
		case "lowest_rated":
			query.buildSort("rating", 1)
			break;
		case "creator_ascending":
			query.buildSort("creators.username", 1)
			break;
		case "creator_descending":
			query.buildSort("creators.username", -1)
			break;
		// case "best_match": 
		// 	sort = {score: {$meta: "textScore"}}
		// 	break;
		default:
			query.buildSort("createdDate", -1)
	}

	if(requestQuery.status && (!requestQuery.exclusiveStatus || requestQuery.exclusiveStatus === "false")) {
		console.log(requestQuery.status)
        query.buildQueryWithOperation("status", Number.parseInt(requestQuery.status), "$gte")
	} else if (requestQuery.status) {
		query.buildQuery("status", Number.parseInt(requestQuery.status))
	}

	if(requestQuery.version) {
        requestQuery.version.replace(".0", "")
        query.buildQuery("files.minecraftVersion", requestQuery.version)
	}

	if(requestQuery.search && requestQuery.search.length > 3 && !(requestQuery.search === "undefined" || requestQuery.search === "null")) {
        query.buildQueryWithOperation("$text", requestQuery.search, "$search")
	}

    if(requestQuery.slug) {
        query.buildQuery("slug", requestQuery.slug)
    }

	if(requestQuery.limit) {
		query.setLimit(Number.parseInt(requestQuery.limit))
	} else {
		requestQuery.setLimit(20)
	}

	if(query.limit === 0) {
		query.setLimit(20)
	}

	if(requestQuery.page) {
		if(requestQuery.page < 0) {
			requestQuery.page = "0"
		}
		query.setSkip(Number.parseInt(requestQuery.page) * query.limit);
	}

	const projection = {
		title: 1,
		// score: { $meta: "textScore" },
		"files.minecraftVersion": 1,
		shortDescription: 1,
		downloads: 1,
		views: 1,
		rating: 1,
		creators: 1,
		images: 1,
		slug: 1,
		createdDate: 1,
		status: 1
	};

	if(useProjection)
    	query.setProjection(projection);

	let count = await database.collection.countDocuments(query.query)

	let cursor = database.executeQuery(query);

	let documents = []
	for await (const doc of cursor) {
		documents.push(doc);
	}
	let result: {totalCount: number, documents: MapDoc[]} = {
		totalCount: count,
		documents: documents as MapDoc[]
	}
	return result;
}

export async function performSearch(requestQuery: any) {
	let search = new Search();

	switch(requestQuery.sort) {
		case "newest":
			search.sort("createdDate", "desc")
			break;
		case "updated":
			search.sort("updatedDate", "desc")
			break;
		case "title_ascending": 
			search.sort("title", "asc")
			break;
		case "title_descending":
			search.sort("title", "desc")
			break;
		case "oldest":
			search.sort("createdDate", "asc")
			break;
		case "highest_rated": 
			search.sort("rating", "desc")
			break;
		case "lowest_rated":
			search.sort("rating", "asc")
			break;
		case "creator_ascending":
			search.sort("creators.username", "asc")
			break;
		case "creator_descending":
			search.sort("creators.username", "desc")
			break;
		// case "best_match": 
		// 	sort = {score: {$meta: "textScore"}}
		// 	break;
		default:
			search.sort("createdDate", "desc")
			break;
	}

	if(requestQuery.status && (!requestQuery.exclusiveStatus || requestQuery.exclusiveStatus === "false")) {
		search.filter("status", ">=", Number.parseInt(requestQuery.status))
	} else if (requestQuery.status) {
		search.filter("status", "=", Number.parseInt(requestQuery.status))
	} else {
		search.filter("status", ">=", 2)
	}

	if(requestQuery.version) {
		requestQuery.version.replace(".0", "")
		search.filter("files.minecraftVersion", "=", requestQuery.version)
	}

	if(requestQuery.search && !(requestQuery.search === "undefined" || requestQuery.search === "null")) {
		search.query(requestQuery.search, false)
	}

	if(requestQuery.limit && requestQuery.page) {
		search.paginate(Number.parseInt(requestQuery.limit), Number.parseInt(requestQuery.page) + 1)
	}

	if(requestQuery.includeTags) {
		let tags = requestQuery.includeTags.split(",")
		for(const tag of tags) {
			search.filter("tags", "=", tag, "AND")
		}
	}

	if(requestQuery.excludeTags) {
		let tags = requestQuery.excludeTags.split(",")
		for(const tag of tags) {
			search.filter("tags", "!=", tag, "AND")
		}
	}

	let documents = await search.execute()?.catch((e) => {
		sendLog("performSearch", e)
	})
	if(!documents) {
		console.error("Meilisearch is probably not initialized.")
		return {totalCount: 0, documents: []}
	}
	return { totalCount: (search.hitsPerPageS) ? documents.totalHits : documents.estimatedTotalHits, documents: documents.hits.map((doc: any) => doc)}
}