import { Collection, MongoClient, Db, Filter, Sort, OptionalUnlessRequiredId, UpdateFilter, Document } from "mongodb"
import { env } from "../env";

export const client = new MongoClient(env.MONGODB_URI);

export type CollectionName = "Maps" | "datapacks" | "resourcepacks" | "creators" | "comments" | "notifications" | "leaderboards" | "marketplace" | "translations"

export class Database<T extends Document> {
    public readonly database: Db
    public readonly collection: Collection<T>

    constructor(collectionName: CollectionName)
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

    async find(query: Filter<T>, limit: number = 20, skip: number = 0, sort: Sort = {}) {
        return this.collection.find<T>(query).limit(limit).skip(skip).sort(sort).toArray();
    }

    async findOne(query: Filter<T>) {
        return this.collection.findOne<T>(query);
    }

    async insertOne(document: OptionalUnlessRequiredId<T>) {
        return this.collection.insertOne(document);
    }

    async updateOne(query: Filter<T>, update: UpdateFilter<T>) {
        return this.collection.updateOne(query, update);
    }

    async deleteOne(query: Filter<T>) {
        return this.collection.deleteOne(query);
    }

    async deleteMany(query: Filter<T>) {
        return this.collection.deleteMany(query);
    }

    async countDocuments(query: Filter<T>) {
        return this.collection.countDocuments(query);
    }
}