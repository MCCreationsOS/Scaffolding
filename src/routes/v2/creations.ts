import { Static, TNumber, TString, TVoid, Type } from "@sinclair/typebox";
import { Router } from "../router";
import { GenericResponseType, WithCount } from "../../schemas/generic";
import { TCollectionName, Creation, TCreation, Sort, CollectionName, ContentType } from "../../schemas/creation";
import { convertContentTypeToCollectionName, Database } from "../../database";
import { ObjectId } from "mongodb";
import { AuthorizationHeader } from "../../schemas/auth";
import { createJWT, getIdFromJWT, processAuthorizationHeader } from "../../auth/user";
import { Search, SearchIndex } from "../../search";
import { checkIfSlugUnique, makeUniqueSlug } from "../../utils/database";
import fetchFromMCMaps from "../../import/minecraftmaps";
import fetchFromPMC from "../../import/planetminecraft";
import fetchFromModrinth from "../../import/modrinth";
import { sendMessage } from "../../discord/bot";
import { UserTypes } from "../../schemas/user";

const collections: CollectionName[] = ["Maps", "datapacks", "resourcepacks", "marketplace"]

/**
 * Body for rating a creation
 */
const RateBody = Type.Object({
    rating: Type.Number(),
    collection: TCollectionName,
    id: Type.String()
})

type RateBody = Static<typeof RateBody>

/**
 * Route for rating a creation
 */
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

    return res.status(200).send(creation.rating)
})

const WithCountCreation = WithCount(TCreation)

type SearchContentTypes = "maps" | "datapacks" | "resourcepacks" | "marketplace" | "all" | "content"

/**
 * Route for searching for creations
 */
Router.app.get<{
    Querystring: {
        slug?: string,
        limit?: string,
        offset?: string,
        sort?: Sort,
        status?: number,
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

    if (req.query.status) {
        if (req.query.exclusiveStatus && req.query.exclusiveStatus === "true") {
            search.filter("status", "=", req.query.status)
        } else {
            search.filter("status", ">=", req.query.status)
        }
    } else {
        search.filter("status", ">=", 1)
    }

    if (req.query.version) {
        search.filter("files.minecraftVersion", "=", req.query.version)
    }

    if (req.query.creators) {
        req.query.creators.split(",").forEach(creator => {
            search.filter("creators.username", "=", creator, "OR")
        })
    }

    if (req.query.includeTags) {
        req.query.includeTags.split(",").forEach(tag => {
            search.filter("tags", "=", tag, "OR")
        })
    }

    if (req.query.excludeTags) {
        req.query.excludeTags.split(",").forEach(tag => {
            search.filter("tags", "!=", tag, "AND")
        })
    }

    if (req.query.limit && req.query.offset) {
        search.paginate(parseInt(req.query.limit), parseInt(req.query.offset))
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
            includeTags?: string[],
            excludeTags?: string[],
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
            return res.status(404).send({ error: "Creation not found" })
        }

        if (creation.status === 0) {
            let user = await processAuthorizationHeader(req.headers.authorization + "")
            if (user && creation.creators) {
                for (let i = 0; i < creation.creators.length; i++) {
                    if (creation.creators[i].handle === user.handle) {
                        return res.status(200).send(creation)
                    }
                }
            } else if (user && creation.owner && creation.owner === user.handle) {
                return res.status(200).send(creation)
            }
        }

        return res.status(200).send(creation)
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
    } else if (req.params.type === "resourcepack") {
        return res.status(200).send({
            genre: ["adventure", "survival", "game", "tool", "overhaul", "creative", "qol"],
            subgenre: ["PVE", "PVP", "challenge", "unfair", "multiplayer", "singleplayer", "crafting", "exploration", "tweak", "magic", "tech", "mobs", "bosses", "weapons", "tools"],
            difficulty: ["chill", "easy", "normal", "hard", "hardcore"],
            theme: ["medieval", "modern", "fantasy", "sci-fi", "realistic", "vanilla"]
        })
    } else if (req.params.type === "marketplace") {
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
    key: Type.Optional(Type.String())
})

Router.app.post<{
    Body: Creation
    Reply: GenericResponseType<typeof UploadCreationResponse>
    Headers: AuthorizationHeader
}>("/creations/upload", async (req, res) => {
    let collectionName = convertContentTypeToCollectionName(req.body.type)
    let database = new Database<Creation>(collectionName)

    let slug = req.body.slug ?? req.body.title.toLowerCase().replace(/\s/g, "_").replace(/[^a-zA-Z0-9_]/g, "")
    slug = await makeUniqueSlug(slug, collectionName)

    req.body.slug = slug

    if (!req.body.createdDate) {
        req.body.createdDate = new Date().toISOString()
    }

    let user = await processAuthorizationHeader(req.headers.authorization + "")
    if (user) {
        req.body.creators = [...req.body.creators, user]
        req.body.owner = user.handle
    }

    let insertionResult = await database.insertOne(req.body)
    if (insertionResult.acknowledged) {
        let key = createJWT({ _id: insertionResult.insertedId.toJSON() }, "24h")
        return res.status(200).send({ creation: req.body, key: key })
    } else {
        return res.status(500).send({ error: "Failed to upload creation" })
    }
})

Router.app.post<{
    Body: {
        url: string,
        type: ContentType
    }
    Reply: GenericResponseType<typeof TCreation>
    Headers: AuthorizationHeader
}>("/creations/import", async (req, res) => {
    if (req.body.url.includes("minecraftmaps.com")) {
        let creation = await fetchFromMCMaps(req.body.url)
        if (typeof creation === "string") {
            return res.status(400).send({ error: creation })
        }
        return res.status(200).send(creation)
    } else if (req.body.url.includes("planetminecraft.com")) {
        let creation = await fetchFromPMC(req.body.url, req.body.type)
        if (typeof creation === "string") {
            return res.status(400).send({ error: creation })
        }
        return res.status(200).send(creation)
    } else if (req.body.url.includes("modrinth.com")) {
        let creation = await fetchFromModrinth(req.body.url, req.body.type)
        if (typeof creation === "string") {
            return res.status(400).send({ error: creation })
        }
        return res.status(200).send(creation)
    } else {
        return res.status(400).send({ error: "Invalid URL" })
    }
})

Router.app.post<{
    Body: Creation
    Reply: GenericResponseType<typeof TCreation>
    Headers: AuthorizationHeader
}>("/creations/update", async (req, res) => {
    let database = new Database<Creation>(convertContentTypeToCollectionName(req.body.type))
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

    let updateResult = await database.updateOne({ _id: new ObjectId(req.body._id) }, { $set: req.body })
    if (updateResult.acknowledged) {
        return res.status(200).send(req.body)
    } else {
        return res.status(500).send({ error: "Failed to update creation" })
    }
})

Router.app.delete<{
    Querystring: {
        type: ContentType
    }
    Params: {
        slug: string
    }
}>("/creations/:slug", async (req, res) => {
    let database = new Database<Creation>(convertContentTypeToCollectionName(req.query.type))
    let deletionResult = await database.deleteOne({ slug: req.params.slug })
    return res.status(200).send(deletionResult)
})

Router.app.get<{
    Querystring: {
        type: ContentType
    }
    Params: {
        slug: string
    }
    Headers: AuthorizationHeader
    Reply: GenericResponseType<typeof TCreation>
}>("/creations/:slug/request_approval", async (req, res) => {
    let database = new Database<Creation>(convertContentTypeToCollectionName(req.query.type))
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
    res.status(200).send(creation)

    let link = `https://mccreations.net/${req.query.type.toLowerCase()}/${creation.slug}`
    sendMessage(`New ${req.query.type} Requesting Approval: ${link}`, "860288020908343346")
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
    let creation = await database.findOne({ slug: req.params.slug })
    if (!creation) {
        return res.status(404).send({ error: "Creation not found" })
    }

    await database.updateOne({ slug: req.params.slug }, { $set: { status: 2 } })
    return res.status(200).send(creation)
})