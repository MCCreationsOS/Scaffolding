import QueryString from 'qs';
import { app } from '../index.js'
import { Database, DatabaseQueryBuilder } from '../db/connect.js';
import { getUserFromJWT } from '../auth/routes.js';
import { MapDoc } from '../db/types.js';

export function initializeMapRoutes() {
    app.get('/maps', async (req, res) => {
        let result = await findMaps(req.query, true);

        if(req.query.sendCount && req.query.sendCount === "true") {
            res.send({count: result.totalCount})
        } else {
            res.send(result);
        }
    })
    app.get('/maps/:slug', async (req, res) => {
        let result = await findMaps({limit: 1, slug: req.params.slug}, false)

		if(result.documents[0].status < 1) {
			let filter = true;
			if(req.headers.authorization) {
				let uObj = await getUserFromJWT(req.headers.authorization)
				if(uObj.user && result.documents[0].creators) {
					for(const creator of result.documents[0].creators) {
						if(creator.handle === uObj.user.handle) filter = false;
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
}

async function findMaps(requestQuery: any, useProjection: boolean) {
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

	if(requestQuery.status) {
        query.buildQueryWithOperation("status", Number.parseInt(requestQuery.status), "$gte")
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
	}
	if(requestQuery.skip) {
		if(requestQuery.skip < 0) {
			requestQuery.skip = "0"
		}
		query.setSkip(Number.parseInt(requestQuery.skip));
	}

	const projection = {
		_id: 0,
		title: 1,
		// score: { $meta: "textScore" },
		"files.minecraftVersion": 1,
		shortDescription: 1,
		downloads: 1,
		rating: 1,
		"creators.username": 1,
		images: 1,
		slug: 1
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