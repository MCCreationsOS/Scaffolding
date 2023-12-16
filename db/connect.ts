import { client } from "../index.js";
import { IDatabaseQuery, MapDoc } from "./types.js";

// const { MongoClient, ServerApiVersion } = require('mongodb');
import { Collection, Filter, MongoClient, ServerApiVersion, Sort, SortDirection, Document, FilterOperators } from 'mongodb';


const connectionsPool: {client: MongoClient, inUse: boolean}[] = [];

export class Database {
    database
    collection

    constructor(databaseName?: string, collectionName?: string) {
        if(databaseName) {
            this.database = client.db(databaseName);
            this.collection = this.database.collection(collectionName || "");
        } else {
            this.database = client.db('content');
            this.collection = this.database.collection('Maps');
        }
        this.createSearchIndex();

    }

    createSearchIndex() {
        this.collection.createIndex({title: "text", "creators.username": "text", shortDescription: "text"})
    }

    executeQuery(query: IDatabaseQuery) {
        let c = this.collection.find(query.query).limit(query.limit).sort(query.sort).project(query.projection).skip(query.skip);
        return c
    }
}

export class DatabaseQueryBuilder {
    query
    sort
    limit
    projection
    skip

    constructor(query?: Filter<Document>, sort?: Sort, projection?: any, limit?: number, skip?: number) {
        this.query = query || {};
        this.sort = sort || {};
        this.projection = projection || {};
        this.limit = limit || 20;
        this.skip = skip || 0;
    }

    buildQuery(field: string, value: any) {
        this.query[field] = value;
    }

    buildQueryWithOperation(field: string, value: any, operation: any) {
        let operator: FilterOperators<typeof value> = {}
        operator[operation] = value;
        this.query = {[field]: operator}
    }

    setQuery(query: any) {
        this.query = query;
    }

    buildSort(field: string, value: SortDirection) {
        this.sort = {[field]: value};
    }

    setSort(sort: any) {
        this.sort = sort;
    }

    setLimit(amount: number) {
        this.limit = amount;
    }

    setProjection(projection: any) {
        this.projection = projection;
    }

    setSkip(amount: number) {
        this.skip = amount;
    }

    createCopy() {
        return new DatabaseQueryBuilder(this.query, this.sort, this.projection, this.limit, this.skip);
    }
}