import { Database, CollectionName } from "../database";
import { ContentType } from "../schemas/creation";

export async function checkIfSlugUnique(slug: string, collection: CollectionName) {
    let database = new Database("content", collection);
    return (await database.collection.findOne({slug: slug})) === null
}

export async function makeUniqueSlug(slug: string, collection: CollectionName) {
    let i = "";
    let isSlugUnique = await checkIfSlugUnique(slug + i, collection)
    while(!isSlugUnique) {
        i += Date.now();
        isSlugUnique = await checkIfSlugUnique(slug + i, collection)
    }
    return slug + i;
}

export function convertContentTypeToCollectionName(contentType: string): CollectionName {
    switch(contentType) {
        case "map":
            return "Maps"
        case "datapack":
            return "datapacks"
        case "resourcepack":
            return "resourcepacks"
        default:
            throw new Error("Invalid content type")
    }
}

export function convertCollectionNameToContentType(collectionName: CollectionName): ContentType {
    switch(collectionName) {
        case "Maps":
            return "map"
        case "datapacks":
            return "datapack"
        case "resourcepacks":
            return "resourcepack"
        default:
            throw new Error("Invalid collection name")
    }
}

export function convertCommentTypeToCollectionName(commentType: string): CollectionName {
    switch(commentType) {
        case "Maps":
            return "Maps"
        case "datapacks":
            return "datapacks"
        case "resourcepacks":
            return "resourcepacks"
        case "wall":
            return "comments"
        default:
            throw new Error("Invalid comment type")
    }
}

