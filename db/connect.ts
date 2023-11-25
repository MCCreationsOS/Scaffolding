import { IDatabaseQuery } from "./types.js";

const { MongoClient, ServerApiVersion } = require('mongodb');
// import { MongoClient, ServerApiVersion } from 'mongodb';

const uri = "***REMOVED***";

export class Database {
    client = new MongoClient(uri).connect();
    database
    collection

    constructor(databaseName?: string, collectionName?: string) {
        this.client.connect();
        if(databaseName) {
            this.database = this.client.db(databaseName);
            this.collection = this.client.collection(collectionName);
        } else {
            this.database = this.client.db('content');
            this.collection = this.client.collection('Maps');
        }

    }

    createSearchIndex() {
        this.collection.createIndex({title: "text", "creators.username": "text", shortDescription: "text"})
    }

    executeQuery(query: IDatabaseQuery) {
        return this.collection.find(query.query).limit(query.limit).sort(query.sort).project(query.projection).skip(query.skip);
    }
}

export class DatabaseQueryBuilder {
    query
    sort
    limit
    projection
    skip

    constructor(query?: any, sort?: any, projection?: any, limit?: number, skip?: number) {
        this.query = query || {};
        this.sort = sort || {};
        this.projection = projection || {};
        this.limit = limit || 20;
        this.skip = skip || 0;
    }

    buildQuery(field: string, value: any) {
        this.query[field] = value;
    }

    buildQueryWithOperation(field: string, value: any, operation: string) {
        this.query[field][operation] = value;
    }

    setQuery(query: any) {
        this.query = query;
    }

    buildSort(field: string, value: any) {
        this.sort[field] = value
    }

    buildSortWithOperation(field: string, value: any, operation: string) {
        this.sort[field][operation] = value;
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