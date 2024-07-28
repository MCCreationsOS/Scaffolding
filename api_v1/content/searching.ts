import { Database, DatabaseQueryBuilder, Search } from "../db/connect.js";
import { ContentDocument, DatabaseCollection, SearchIndex } from "../db/types.js";
import { sendLog } from "../logging/logging.js";

export async function findContent(collection: DatabaseCollection, requestQuery: any, useProjection: boolean) {
    let database = new Database("content", collection);
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
		query.setLimit(20)
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

    if(requestQuery.creator) {
        query.buildQuery("$or", [{ "creators.handle": requestQuery.creator }, { owner: requestQuery.creator }])
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
	let result: {totalCount: number, documents: ContentDocument[]} = {
		totalCount: count,
		documents: documents as ContentDocument[]
	}
	return result;
}

export async function performSearch(requestQuery: any) {
	let indexes: SearchIndex[]

	switch(requestQuery.contentType) {
		case "Maps":
			indexes = [SearchIndex.Maps]
			break;
		case "resourcepacks":
			indexes = [SearchIndex.Resourcepacks]
			break;
		case "datapacks":
			indexes = [SearchIndex.Datapacks]
			break;
		case "content":
			indexes = [SearchIndex.Maps, SearchIndex.Resourcepacks, SearchIndex.Datapacks]
			break;
		default:
			indexes = [SearchIndex.Maps]
			break;
	}

	let search = new Search(indexes)

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
		case "lowest_downloads":
			search.sort("downloads", "asc")
			break;
		case "highest_downloads":
			search.sort("downloads", "desc")
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

	let documents = await search.execute()
	if(!documents) {
		console.error("Meilisearch is probably not initialized.")
		return {totalCount: 0, documents: []}
	}
	return documents;
}