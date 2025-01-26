import { Database, CollectionName } from "../database";

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
