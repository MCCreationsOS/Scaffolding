import { Static, TNumber, TVoid, Type } from "@sinclair/typebox";
import { Router } from "../router";
import { GenericResponseType, WithCount } from "../../schemas/generic";
import { CollectionName, Creation, Sort } from "../../schemas/creation";
import { Database } from "../../database";
import { ObjectId } from "mongodb";
import { AuthorizationHeader } from "../../schemas/auth";
import { getUserFromJWT } from "../../auth/user";
import { Search, SearchIndex } from "../../search";

const contentTypes: CollectionName[] = ["Maps", "datapacks", "resourcepacks", "marketplace"]

const RateBody = Type.Object({
    rating: Type.Number(),
    collection: CollectionName,
    id: Type.String()
})

type RateBody = Static<typeof RateBody>

Router.app.post<{
    Body: RateBody,
    Reply: GenericResponseType<TNumber>
}>("/rate", async (req, res) => {
    let database = new Database<Creation>(req.body.collection)
    let creation = await database.findOne({_id: new ObjectId(req.body.id)})
    if(!creation) {
        res.status(404).send({error: "Creation not found"})
        return
    }

    let totalRating = 0;
    if(creation.ratings) {
        creation.ratings.push(req.body.rating)
    } else {
        creation.ratings = [req.body.rating];
    }

    for(let i = 0; i < creation.ratings.length; i++) {
        totalRating += creation.ratings[i];
    }

    creation.rating = totalRating / creation.ratings.length
    await database.updateOne({_id: new ObjectId(req.body.id)}, {$set: {rating: creation.rating, ratings: creation.ratings}})

    res.status(200).send(creation.rating)
})

const WithCountCreation = WithCount(Creation)

type SearchContentTypes = "maps" | "datapacks" | "resourcepacks" | "marketplace" | "all" | "content"

Router.app.get<{
    Querystring: {
        slug?: string,
        limit?: string,
        offset?: string,
        sort?: Sort,
        status?: number,
        exclusiveStatus?: boolean,
        version?: string,
        search?: string,
        includeTags?: string[],
        excludeTags?: string[],
        creators?: string[],
        contentType?: SearchContentTypes
    }
    Reply: GenericResponseType<typeof WithCountCreation>
    Headers: AuthorizationHeader
}>("/creations", async (req, res) => {
    let indexes: SearchIndex[] = []
    switch(req.query.contentType) {
        case "all":
            indexes.push("maps", "datapacks", "resourcepacks", "marketplace")
            break
        case "content":
            indexes.push("maps", "datapacks", "resourcepacks")
            break
        case "marketplace":
            indexes.push("marketplace")
            break
        case "maps":
            indexes.push("maps")
            break
        case "datapacks":
            indexes.push("datapacks")
            break
        case "resourcepacks":
            indexes.push("resourcepacks")
            break
        default:
            indexes = ["maps", "datapacks", "resourcepacks", "marketplace"]
            break
    }

    const search = new Search(indexes)
    search.query(req.query.search ?? "", false)

    switch(req.query.sort) {
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
		case "least_downloaded":
			search.sort("downloads", "asc")
			break;
		case "most_downloaded":
			search.sort("downloads", "desc")
			break;
		default:
			search.sort("createdDate", "desc")
			break;
	}

    if(req.query.status) {
        if(req.query.exclusiveStatus) {
            search.filter("status", "=", req.query.status)
        } else {
            search.filter("status", ">=", req.query.status)
        }
    } else {
        search.filter("status", ">=", 1)
    }

    if(req.query.version) {
        search.filter("files.minecraftVersion", "=", req.query.version)
    }

    if(req.query.creators) {
        req.query.creators.forEach(creator => {
            search.filter("creators.username", "=", creator, "OR")
        })
    }

    if(req.query.includeTags) {
        req.query.includeTags.forEach(tag => {
            search.filter("tags", "=", tag, "OR")
        })
    }

    if(req.query.excludeTags) {
        req.query.excludeTags.forEach(tag => {
            search.filter("tags", "!=", tag, "AND")
        })
    }

    if(req.query.limit && req.query.offset) {
        search.paginate(parseInt(req.query.limit), parseInt(req.query.offset))
    }

    let documents = await search.execute()

    if(!documents) {
        res.status(404).send({error: "No creations found"})
        return
    }

    res.status(200).send({
        totalCount: documents.totalCount,
        documents: documents.documents
    })
})

contentTypes.forEach((contentType) => {

    Router.app.get<{
        Querystring: {
            slug?: string,
            limit?: string,
            offset?: string,
            sort?: Sort,
            status?: number,
            exclusiveStatus?: boolean,
            version?: string,
            search?: string,
            includeTags?: string[],
            excludeTags?: string[],
            creator?: string
        }
        Reply: GenericResponseType<typeof WithCountCreation>
        Headers: AuthorizationHeader
    }>(`/creations/${contentType.toLowerCase()}`, async (req, res) => {
        let database = new Database<Creation>(contentType)
        let query: any = {}
        if(req.query.slug) query.slug = req.query.slug
        if(req.query.status) query.status = {$gte: req.query.status}
        if(req.query.exclusiveStatus) query.status = req.query.status
        if(req.query.version) query.files.minecraftVersion = req.query.version
        if(req.query.search) query.search = req.query.search
        if(req.query.includeTags) query.tags = {$in: req.query.includeTags}
        if(req.query.excludeTags) query.tags = {$nin: req.query.excludeTags}
        if(req.query.creator) query.creators.username = req.query.creator

        let sort: any = {}
        switch(req.query.sort) {
            case "newest":
                sort.createdDate = -1
                break
            case "updated":
                sort.updatedDate = -1
                break
            case "oldest":
                sort.createdDate = 1
                break
            case "highest_rated":
                sort.rating = -1
                break
            case "lowest_rated":
                sort.rating = 1
                break
            case "title_ascending":
                sort.title = 1
                break
            case "title_descending":
                sort.title = -1
                break
            case "creator_ascending":
                sort.creators.username = 1
                break
            case "creator_descending":
                sort.creators.username = -1
                break
            case "most_downloaded":
                sort.downloads = -1
                break
            case "least_downloaded":
                sort.downloads = 1
                break
            default:
                sort.createdDate = -1
                break
        }

        let creations = await database.collection.find(query).sort(sort).limit(parseInt(req.query.limit ?? "20")).skip(parseInt(req.query.offset ?? "0")).toArray()
        res.status(200).send({
            totalCount: creations.length,
            documents: creations
        })
    })
    
    Router.app.get<{
        Params: {
            slug: string
        }
        Reply: GenericResponseType<typeof Creation>
        Headers: AuthorizationHeader
    }>(`/creations/${contentType.toLowerCase()}/:slug`, async (req, res) => {
        let database = new Database<Creation>(contentType)
        let creation = await database.findOne({slug: req.params.slug})
        if(!creation) {
            res.status(404).send({error: "Creation not found"})
            return
        }

        if(creation.status === 0) {
            let user = await getUserFromJWT(req.headers.authorization + "")
            if(user && creation.creators) {
                for(let i = 0; i < creation.creators.length; i++) {
                    if(creation.creators[i].handle === user.handle) {
                        res.status(200).send(creation)
                        return
                    }
                }
            } else if(user && creation.owner && creation.owner === user.handle) {
                res.status(200).send(creation)
                return
            }
        }

        res.status(200).send(creation)
    })

    
})