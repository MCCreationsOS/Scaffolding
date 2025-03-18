import { Static, TNumber, TString, TVoid, Type } from "@sinclair/typebox";
import { Router } from "../router";
import { ErrorSchema, GenericResponseType, WithCount } from "../../schemas/generic";
import { TCollectionName, Creation, TCreation, Sort, CollectionName, ContentType, TSort, TStatus, TContentType } from "../../schemas/creation";
import { Database } from "../../database";
import { ObjectId } from "mongodb";
import { AuthorizationHeader } from "../../schemas/auth";
import { createJWT, getIdFromJWT, processAuthorizationHeader } from "../../auth/user";
import { convertContentTypeToSearchIndex, Search, SearchIndex } from "../../search";
import { checkIfSlugUnique, convertCollectionNameToContentType, convertContentTypeToCollectionName, makeUniqueSlug } from "../../utils/database";
import fetchFromMCMaps from "../../import/minecraftmaps";
import fetchFromPMC from "../../import/planetminecraft";
import fetchFromModrinth from "../../import/modrinth";
import { postNewCreation, sendMessage } from "../../discord/bot";
import { UserType, UserTypes } from "../../schemas/user";
import { createNotificationsForSubscribers, createNotificationToCreators } from "../../notifications";
import { createDefaultCreation, ProgressStream } from "../../utils/creations";
import { approvedEmail } from "../../email";
import { Duplex, Readable } from "stream";
const collections: CollectionName[] = ["Maps", "datapacks", "resourcepacks", "marketplace"]

/**
 * Body for rating a creation
 */
const RateBody = Type.Object({
    id: Type.String({description: "The id of the creation to rate"}),
    rating: Type.Number({description: "The rating to set the creation to"}),
    collection: TCollectionName,
}, {description: "The body for rating a creation"})

type RateBody = Static<typeof RateBody>

Router.app.post<{
    Body: RateBody,
    Reply: GenericResponseType<TNumber>
}>("/rate", async (req, res) => {
    let database = new Database<Creation>(req.body.collection)
    let creation = await database.findOne({ _id: new ObjectId(req.body.id) })
    if (!creation) {
        res.status(404).send({ error: "Creation not found" })
        return
    }

    let totalRating = 0;
    if (creation.ratings) {
        creation.ratings.push(req.body.rating)
    } else {
        creation.ratings = [req.body.rating];
    }

    for (let i = 0; i < creation.ratings.length; i++) {
        totalRating += creation.ratings[i];
    }

    creation.rating = totalRating / creation.ratings.length
    await database.updateOne({ _id: new ObjectId(req.body.id) }, { $set: { rating: creation.rating, ratings: creation.ratings } })

    res.status(200).send(creation.rating)

    let creatorDatabase = new Database<UserType>("creators")
    let creator = await creatorDatabase.findOne({handle: creation.owner})
    if(creator) {
        createNotificationToCreators({
            content: creation,
            type: "rating",
            title: {key: "Account.Notifications.NewRating.title"},
            body: {key: "Account.Notifications.NewRating.body", options: {rating: req.body.rating * 5, content_type: creation.title}}
        })
    }
})

const WithCountCreation = WithCount(TCreation)

type SearchContentTypes = "maps" | "datapacks" | "resourcepacks" | "marketplace" | "all" | "content"

Router.app.get<{
    Querystring: {
        slug?: string,
        limit?: string,
        page?: string,
        sort?: Sort,
        status?: string,
        exclusiveStatus?: string,
        version?: string,
        search?: string,
        includeTags?: string,
        excludeTags?: string,
        creators?: string,
        contentType?: SearchContentTypes
    }
    Reply: GenericResponseType<typeof WithCountCreation>
    Headers: AuthorizationHeader
}>("/creations", async (req, res) => {
    // Get the indexes to search on Meilisearch
    let indexes: SearchIndex[] = []
    switch (req.query.contentType?.toLowerCase()) {
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
    const user = await processAuthorizationHeader(req.headers.authorization + "")

    // Build search query
    search.query(req.query.search ?? "", false)

    switch (req.query.sort) {
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

    "status = 0 AND version = 1.12 OR creators = CCMM OR includeTags = 'pve' OR excludeTags != 'pvp' AND"

    
    if (req.query.version) {
        search.filter({filter: {key: "files.minecraftVersion", operation: "=", value: req.query.version}})
    }
    
    if (req.query.creators) {
        if (req.query.creators.includes(",")) {
            search.filter({filter: req.query.creators.split(",").map(creator => {
                return {key: "creators.handle", operation: "=", value: creator, combiner: "OR"}
            }), combiner: "AND"})
        } else {
            search.filter({filter: {key: "creators.handle", operation: "=", value: req.query.creators}})
        }
    }
    
    if (req.query.includeTags) {
        search.filter({filter: req.query.includeTags.split(",").map(tag => {
            return {key: "tags", operation: "=", value: tag, combiner: "OR"}
        }), combiner: "AND"})
    }
    
    if (req.query.excludeTags) {
        search.filter({filter: req.query.excludeTags.split(",").map(tag => {
            return {key: "tags", operation: "!=", value: tag, combiner: "AND"}
        }), combiner: "AND"})
    }
    
    if (req.query.status) {
        const status = parseInt(req.query.status)
        const exclusiveStatus = req.query.exclusiveStatus === "true"
        const operation = exclusiveStatus ? "=" : ">="
        if (isNaN(status)) {
            return res.status(400).send({ error: "Invalid status" })
        }
    
        if(status === 0) {
            if(user && user.type === UserTypes.Admin) {
                search.filter({filter: {key: "status", operation: operation, value: 0, combiner: "AND"}})
            } else {
                search.filter({filter: {key: "status", operation: operation, value: 0, combiner: "AND"}})
                search.filter({filter: [{key: "creators.handle", operation: "=", value: user?.handle ?? ""}, {key: "owner", operation: "=", value: user?.handle ?? "", combiner: "OR"}], combiner: "AND"})
            }
        } else {
            search.filter({filter: {key: "status", operation: operation, value: status, combiner: "AND"}})
        }
    } else {
        search.filter({filter: {key: "status", operation: ">=", value: 1, combiner: "AND"}})
    }

    if (req.query.limit && req.query.page) {
        search.paginate(parseInt(req.query.limit), parseInt(req.query.page) + 1)
    }
    
    let documents = await search.execute()
    
    if (!documents) {
        return res.status(404).send({ error: "No creations found" })
    }
    
    return res.status(200).send({
        totalCount: documents.totalCount,
        documents: documents.documents
    })
})

// Create routes for each content type
collections.forEach((collection) => {
    
    // Route for getting creations of a specific content type
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
            includeTags?: string,
            excludeTags?: string,
            creator?: string
        }
        Reply: GenericResponseType<typeof WithCountCreation>
        Headers: AuthorizationHeader
    }>(`/creations/${collection.toLowerCase()}`, async (req, res) => {
        let database = new Database<Creation>(collection)

        // Build query
        let query: any = {}
        if (req.query.slug) query.slug = req.query.slug
        if (req.query.status) query.status = { $gte: req.query.status }
        if (req.query.exclusiveStatus) query.status = req.query.status
        if (req.query.version) query.files.minecraftVersion = req.query.version
        if (req.query.search) query.search = req.query.search
        if (req.query.includeTags) query.tags = { $in: req.query.includeTags }
        if (req.query.excludeTags) query.tags = { $nin: req.query.excludeTags }
        if (req.query.creator) query.creators.username = req.query.creator

        // Build sort
        let sort: any = {}
        switch (req.query.sort) {
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

        let creations = await database.find(query, parseInt(req.query.limit ?? "20"), parseInt(req.query.offset ?? "0"), sort)
        return res.status(200).send({
            totalCount: creations.length,
            documents: creations
        })
    })

    // Route for getting a single creation by slug
    Router.app.get<{
        Params: {
            slug: string
        }
        Reply: GenericResponseType<typeof TCreation>
        Headers: AuthorizationHeader
    }>(`/creations/${collection.toLowerCase()}/:slug`, async (req, res) => {
        let database = new Database<Creation>(collection)
        let creation = await database.findOne({ slug: req.params.slug })
        if (!creation) {
            creation = await database.findOne({ slug: encodeURI(req.params.slug) })
            if (!creation) {
                return res.status(404).send({ error: "Creation not found" })
            }
        }


        if (creation.status === 0) {
            let user = await processAuthorizationHeader(req.headers.authorization + "")
            if (user && creation.creators) {
                for (let i = 0; i < creation.creators.length; i++) {
                    if (creation.creators[i].handle === user.handle) {
                        return res.status(200).send(creation)
                    }
                }
                if(user.type === UserTypes.Admin) {
                    return res.status(200).send(creation)
                }
            } else if (user && creation.owner && creation.owner === user.handle) {
                return res.status(200).send(creation)
            } else if (user && user.type === UserTypes.Admin) {
                return res.status(200).send(creation)
            }
            return res.status(401).send({ error: "Creation not found" })
        }

        return res.status(200).send(creation)
    })

    Router.app.get<{
        Params: {
            slug: string
        }
        Reply: GenericResponseType<TVoid>
        Headers: AuthorizationHeader
    }>(`/creations/${collection.toLowerCase()}/:slug/download`, async (req, res) => {
        let database = new Database<Creation>(collection)
        await database.updateOne({ slug: req.params.slug }, { $inc: { downloads: 1 } })
        return res.status(200).send()
    })
})

Router.app.get<{
    Params: {
        type: ContentType
    }
    Reply: GenericResponseType<any>
}>("/creations/tags/:type", async (req, res) => {
    if (req.params.type === "map") {
        return res.status(200).send({
            genre: ["adventure", "parkour", "survival", "puzzle", "game", "build"],
            subgenre: ["horror", "PVE", "PVP", "episodic", "challenge", 'CTM', "RPG", "trivia", "escape", "finding", "maze", "unfair", "dropper", "elytra", "city", "park", "multiplayer", "singleplayer", "co-op"],
            difficulty: ["chill", "easy", "normal", "hard", "hardcore"],
            theme: ["medieval", "modern", "fantasy", "sci-fi", "realistic", "vanilla"],
            length: ["short", "medium", "long"]
        })
    } else if (req.params.type === "datapack") {
        return res.status(200).send({
            genre: ["adventure", "survival", "game", "tool", "overhaul", "creative", "qol"],
            subgenre: ["PVE", "PVP", "challenge", "unfair", "multiplayer", "singleplayer", "crafting", "exploration", "tweak", "magic", "tech", "mobs", "bosses", "weapons", "tools"],
            difficulty: ["chill", "easy", "normal", "hard", "hardcore"],
            theme: ["medieval", "modern", "fantasy", "sci-fi", "realistic", "vanilla"]
        })
    } else if (req.params.type === "marketplace") {
        return res.status(200).send({
            genre: ["map", "datapack", "resourcepack"],
            subgenre: ["adventure", "parkour", "survival", "puzzle", "game", "build", "pvp", "pve", "creative", "qol", "utility", "other", "tool", "overhaul", "realistic", "simple", "themed"],
            difficulty: ["chill", "easy", "normal", "hard", "hardcore"],
            theme: ["medieval", "modern", "fantasy", "sci-fi", "realistic", "vanilla"]
        })
    } else if (req.params.type === "resourcepack") {
        return res.status(200).send({
            genre: ["realistic", "simple", "themed", "utility", "other"],
            subgenre: ["cartoon", "smooth", "faithful", "other", "PVP", "entities", "items", "blocks", "GUI", "font", "sound", "music", "language", "weapons", "funny", "cosmetic", "models", "shaders", "skybox"],
            resolution: ["8x", "16x", "32x", "64x", "128x", "256x", "512x", "1024x +"],
            theme: ["medieval", "modern", "fantasy", "sci-fi", "realistic", "vanilla", "anime"]
        })
    }
})

const UploadCreationResponse = Type.Object({
    creation: TCreation,
    key: Type.Optional(Type.String({description: "The JWT for the creation if the creator was not logged in."}))
})

Router.app.post<{
    Body: Creation
    Reply: GenericResponseType<typeof UploadCreationResponse>
    Headers: AuthorizationHeader
}>("/creations/upload", async (req, res) => {
    let collectionName = convertContentTypeToCollectionName(req.body.type)
    let database = new Database<Creation>(collectionName)
    let search = new Search([convertContentTypeToSearchIndex(req.body.type)])

    let creation = createDefaultCreation(req.body)

    let slug = (creation.slug === "") ? creation.title.toLowerCase().replace(/\s/g, "_").replace(/[^a-zA-Z0-9_]/g, "") : creation.slug
    slug = await makeUniqueSlug(slug, collectionName)

    creation.slug = slug

    if (!creation.createdDate) {
        creation.createdDate = new Date()
    }


    let user = await processAuthorizationHeader(req.headers.authorization + "")
    if (user) {
        creation.creators = [...creation.creators ?? [], user]
        creation.owner = user.handle
    }

    let insertionResult = await database.insertOne(creation)

    if (insertionResult.acknowledged) {
        let key = createJWT({ _id: insertionResult.insertedId.toJSON() }, "24h")
        creation._id = insertionResult.insertedId
        search.addDocument(creation)
        return res.status(200).send({ creation: creation, key: key })
    } else {
        return res.status(500).send({ error: "Failed to upload creation" })
    }
})

Router.app.post<{
    Body: {
        url: string,
        type: CollectionName
    }
    Headers: AuthorizationHeader
}>("/creations/import", async (req, res) => {
    res.header("Cache-Control", "no-cache")
    res.header("Connection", "keep-alive")
    res.header("Content-Type", "text/event-stream")
    let database = new Database<Creation>(req.body.type)
    let search = new Search([req.body.type.toLowerCase() as SearchIndex])
    let creation: Creation | string | undefined = undefined

    let stream = new ProgressStream()
    res.send(stream)

    if (req.body.url.includes("minecraftmaps.com")) {
        creation = await fetchFromMCMaps(req.body.url, stream)
    } else if (req.body.url.includes("planetminecraft.com")) {
        creation = await fetchFromPMC(req.body.url, convertCollectionNameToContentType(req.body.type), stream)
    } else if (req.body.url.includes("modrinth.com")) {
        creation = await fetchFromModrinth(req.body.url, convertCollectionNameToContentType(req.body.type), stream)
    } else {
        stream.sendUpdate("error", "Invalid URL")
        return stream.destroy(new Error("Invalid URL"))
    }

    if (typeof creation === "string" || !creation) {
        stream.sendUpdate("error", creation ?? "Error fetching creation")
        return stream.destroy(new Error(creation ?? "Error fetching creation"))
    }



    const user = await processAuthorizationHeader(req.headers.authorization + "")
    if (user) {
        creation.creators = [...creation.creators ?? [], user]
        creation.owner = user.handle
    } else {
        creation.key = createJWT({ _id: new ObjectId() }, "24h")
    }

    let insertionResult = await database.insertOne(creation)
    if (insertionResult.acknowledged) {
        creation._id = insertionResult.insertedId
        search.addDocument(creation)
        stream.sendUpdate("complete", {creation: creation, status: "success", key: creation.key})
        return stream.end()
    } else {
        stream.sendUpdate("error", "Failed to upload creation")
        return stream.destroy(new Error("Failed to upload creation"))
    }

})


Router.app.post<{
    Body: Creation
    Reply: GenericResponseType<typeof TCreation>
    Headers: AuthorizationHeader
}>("/creations/update", async (req, res) => {
    let database = new Database<Creation>(convertContentTypeToCollectionName(req.body.type))
    let search = new Search([convertContentTypeToSearchIndex(req.body.type)])
    let creation = await database.findOne({ _id: new ObjectId(req.body._id) })


    let user = await processAuthorizationHeader(req.headers.authorization + "")
    let ignoreOwnerOrCreator = false
    if (!user) {
        let key = getIdFromJWT(req.headers.authorization + "")
        if (!key) {
            return res.status(401).send({ error: "Unauthorized" })
        } else if (key instanceof ObjectId && !key.equals(creation?._id)) {
            return res.status(401).send({ error: "Unauthorized" })
        } else {
            ignoreOwnerOrCreator = true
        }

    }

    if (!creation) {
        return res.status(404).send({ error: "Creation not found" })
    }

    if (!ignoreOwnerOrCreator) {
        if (creation.owner !== user?.handle && creation.creators.filter(creator => creator.handle === user?.handle).length === 0) {
            return res.status(401).send({ error: "Unauthorized" })
        }
    }

    if (req.body.slug !== creation.slug) {
        req.body.slug = await makeUniqueSlug(req.body.slug, convertContentTypeToCollectionName(req.body.type))
    }

    req.body._id = new ObjectId(req.body._id)

    let updateResult = await database.updateOne({ _id: req.body._id }, { $set: req.body })

    if (updateResult.acknowledged) {
        search.updateDocument(req.body)
        return res.status(200).send(req.body)
    } else {
        return res.status(500).send({ error: "Failed to update creation" })
    }
})

Router.app.delete<{
    Querystring: {
        type: CollectionName
    }
    Params: {
        slug: string
    },
    Headers: AuthorizationHeader
}>("/creations/:slug", async (req, res) => {
    let user = await processAuthorizationHeader(req.headers.authorization + "")
    if (!user) {
        return res.status(401).send({ error: "Unauthorized" })
    }

    let database = new Database<Creation>(req.query.type)
    let search = new Search([req.query.type.toLowerCase() as SearchIndex])
    let creation = await database.findOne({ slug: req.params.slug })
    if (!creation) {
        creation = await database.findOne({ slug: encodeURI(req.params.slug) })
        if (!creation) {
            return res.status(404).send({ error: "Creation not found" })
        }
    }

    if (creation.owner !== user?.handle && creation.creators.filter(creator => creator.handle === user?.handle).length === 0) {
        return res.status(401).send({ error: "Unauthorized" })
    }

    search.deleteDocument(creation)
    let deletionResult = await database.deleteOne({ slug: creation.slug })
    return res.status(200).send(deletionResult)

})

Router.app.get<{
    Querystring: {
        type: CollectionName
    }
    Params: {
        slug: string
    }
    Headers: AuthorizationHeader
    Reply: GenericResponseType<typeof TCreation>
}>("/creations/:slug/request_approval", async (req, res) => {
    let database = new Database<Creation>(req.query.type)
    let search = new Search([req.query.type.toLowerCase() as SearchIndex])
    let creation = await database.findOne({ slug: req.params.slug })
    if (!creation) {
        return res.status(404).send({ error: "Creation not found" })
    }

    let user = await processAuthorizationHeader(req.headers.authorization + "")
    let ignoreOwnerOrCreator = false
    if (!user) {
        let key = getIdFromJWT(req.headers.authorization + "")
        if (!key) {
            return res.status(401).send({ error: "Unauthorized" })
        } else if (key instanceof ObjectId && !key.equals(creation?._id)) {
            return res.status(401).send({ error: "Unauthorized" })
        } else {
            ignoreOwnerOrCreator = true
        }
    }

    if (!ignoreOwnerOrCreator) {
        if (creation.owner !== user?.handle && creation.creators.filter(creator => creator.handle === user?.handle).length === 0) {
            return res.status(401).send({ error: "Unauthorized" })
        }
    }

    await database.updateOne({ slug: req.params.slug }, { $set: { status: 1 } })
    creation.status = 1
    search.updateDocument(creation)
    res.status(200).send(creation)

    let link = `https://mccreations.net/${req.query.type.toLowerCase()}/${creation.slug}`
    sendMessage(`New ${req.query.type} Requesting Approval: ${link}`, "860288020908343346")

    createNotificationsForSubscribers({
        creators: creation.creators,
        link: link,
        title: {key: "Account.Notifications.NewCreation.title"},
        body: {key: "Account.Notifications.NewCreation.body", options: {type: req.query.type, username: user?.username}}
    })
})

Router.app.get<{
    Querystring: {
        type: ContentType
    }
    Params: {
        slug: string
    }
    Reply: GenericResponseType<typeof TCreation>
    Headers: AuthorizationHeader
}>("/creations/:slug/approve", async (req, res) => {
    let user = await processAuthorizationHeader(req.headers.authorization + "")
    if (!user) {
        return res.status(401).send({ error: "Unauthorized" })
    }

    if (user.type !== UserTypes.Admin) {
        return res.status(401).send({ error: "Unauthorized" })
    }

    let database = new Database<Creation>(convertContentTypeToCollectionName(req.query.type))
    let search = new Search([convertContentTypeToSearchIndex(req.query.type)])
    let creation = await database.findOne({ slug: req.params.slug })
    if (!creation) {
        return res.status(404).send({ error: "Creation not found" })
    }


    await database.updateOne({ slug: req.params.slug }, { $set: { status: 2 } })
    creation.status = 2
    search.updateDocument(creation)
    res.status(200).send(creation)

    postNewCreation(creation, "<@&883788946327347210>")

    let creators = creation.creators
    creators?.forEach(async (creator) => {
        let creators = new Database('content', 'creators')
        let user = await creators.collection.findOne({handle: creator.handle})
        if(user && user.email) {
            approvedEmail(user.email, `https://mccreations.net/${creation.type.toLowerCase()}s/${creation.slug}`, creation?.title + "")
        }
    })
})

Router.app.post<{
    Body: {
        type: ContentType,
        translation: {
            [key: string]: {
                title: string,
                description: string,
                shortDescription: string,
                author: string,
                approved: boolean,
                date: string
            }
        }
    }
    Params: {
        slug: string
    }
    Reply: GenericResponseType<typeof TCreation>
    Headers: AuthorizationHeader
}>("/creations/:slug/translate", async (req, res) => {
    let database = new Database<Creation>(convertContentTypeToCollectionName(req.body.type))
    let creation = await database.findOne({ slug: req.params.slug })
    if (!creation) {
        return res.status(404).send({ error: "Creation not found" })
    }

    let user = await processAuthorizationHeader(req.headers.authorization + "")
    let key = Object.keys(req.body.translation)[0]

    if(user) {
        req.body.translation[key].author = user.handle!
    }

    req.body.translation[key].date = new Date().toISOString()

    let cursor = await database.collection.aggregate<Creation>([
        {
          '$match': {
            'slug': req.params.slug
          }
        }, {
          '$set': {
            'translations': {
              '$mergeObjects': [
                '$translations', req.body.translation
              ]

            }
          }
        }
      ])
    let updated = await cursor.toArray();
    database.collection.updateOne({slug: req.params.slug}, {$set: updated[0]})
    res.status(200).send(updated[0])

    if(user && user.handle !== updated[0].owner) {
        createNotificationToCreators({
            content: updated[0],
            type: "translation",
            title: {key: "Account.Notifications.NewTranslation.title"},
            body: {key: "Account.Notifications.NewTranslation.body", options: {type: req.body.type, username: user?.username, language: key}}
        })
    }
})