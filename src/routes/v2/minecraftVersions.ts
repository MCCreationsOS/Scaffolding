import { GenericResponseType, MinecraftVersion, TMinecraftVersion, WithCount } from "../../schemas/generic";
import { Search } from "../../search";
import { Router } from "../router";

const WithCountMinecraftVersion = WithCount(TMinecraftVersion)

Router.app.get<{
    Querystring: {
        search: string,
        sort: "newest" | "oldest",
        page: string,
        limit: string,
        types: string
    }
    Reply: GenericResponseType<typeof WithCountMinecraftVersion>
}>("/minecraftVersions", async (req, res) => {
    let search = new Search<MinecraftVersion>(["minecraft_versions"])
    search.query((req.query.search ?? "").replaceAll(".", "-").replaceAll(" ", "_"), false)

    switch (req.query.sort) {
        case "newest":
            search.sort("time", "desc")
            break
        case "oldest":
            search.sort("time", "asc")
            break
        default:
            search.sort("time", "desc")
            break
    }
    
    if(req.query.types) {
        search.filter({filter: req.query.types.split(",").map((type: string) => {
            return {key: "type", operation: "=", value: type, combiner: "OR"}
        })})
    } else {
        search.filter({filter: {key: "type", operation: "=", value: "release"}})
    }

    if(req.query.page && req.query.limit) {
        search.paginate(parseInt(req.query.limit), parseInt(req.query.page))
    } else {
        search.paginate(5, 1)
    }

    let documents = await search.execute()

    if(!documents) {
        return res.status(404).send({
            error: "No versions found"
        })
    }

    documents.documents = documents.documents.map((version: MinecraftVersion) => {
        return {
            ...version,
            id: version.id.replaceAll("-", ".").replaceAll("_", " ")
        }
    })

    return res.status(200).send({
        totalCount: documents.totalCount,
        documents: documents.documents
    })
})
