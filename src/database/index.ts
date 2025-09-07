import { Collection, MongoClient, Db, Filter, Sort, OptionalUnlessRequiredId, UpdateFilter, Document } from "mongodb"
import { env } from "../env";

export const client = new MongoClient(env.MONGODB_URI);

export type CollectionName = "Maps" | "datapacks" | "resourcepacks" | "creators" | "comments" | "notifications" | "leaderboards" | "marketplace" | "translations" | "files" | "blog"

/**
 * A database class for interacting with the database
 */
export class Database<T extends Document> {
    /**
     * The database
     */
    public readonly database: Db
    /**
     * The collection
     */
    public readonly collection: Collection<T>

    /**
     * Constructor for the database class
     * @param collectionName The name of the collection
     */
    constructor(collectionName: CollectionName)
    /**
     * Constructor for the database class
     * @param databaseName The name of the database
     * @param collectionName The name of the collection
     */
    constructor(databaseName: string, collectionName: CollectionName)
    constructor(arg1: string, arg2?: CollectionName) {
        if(arg2 !== undefined) {
            this.database = client.db(arg1);
            this.collection = this.database.collection(arg2);
        } else {
            this.database = client.db('content');
            this.collection = this.database.collection(arg1);
        }
    }

    /**
     * Finds documents in the collection
     * @param query The query to find
     * @param limit The limit of the query
     * @param skip The skip of the query
     * @param sort The sort of the query
     * @returns The documents found
     */
    async find(query: Filter<T>, limit: number = 20, skip: number = 0, sort: Sort = {}) {
        return this.collection.find<T>(query).limit(limit).skip(skip).sort(sort).toArray();
    }

    /**
     * Finds a single document in the collection
     * @param query The query to find
     * @returns The document found
     */
    async findOne(query: Filter<T>) {
        return this.collection.findOne<T>(query);
    }

    /**
     * Inserts a document into the collection
     * @param document The document to insert
     * @returns The document inserted
     */
    async insertOne(document: OptionalUnlessRequiredId<T>) {
        return this.collection.insertOne(document);
    }

    /**
     * Updates a document in the collection
     * @param query The query to update
     * @param update The update to apply
     * @returns The document updated
     */
    async updateOne(query: Filter<T>, update: UpdateFilter<T>) {
        return this.collection.updateOne(query, update);
    }

    /**
     * Deletes a document from the collection
     * @param query The query to delete
     * @returns The document deleted
     */
    async deleteOne(query: Filter<T>) {
        return this.collection.deleteOne(query);
    }

    /**
     * Deletes multiple documents from the collection
     * @param query The query to delete
     * @returns The documents deleted
     */
    async deleteMany(query: Filter<T>) {
        return this.collection.deleteMany(query);
    }

    /**
     * Counts the number of documents in the collection
     * @param query The query to count
     * @returns The number of documents
     */
    async countDocuments(query: Filter<T>) {
        return this.collection.countDocuments(query);
    }
}