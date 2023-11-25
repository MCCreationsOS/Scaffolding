// const { MongoClient, ServerApiVersion } = require('mongodb');
import { MongoClient } from 'mongodb';
const uri = "***REMOVED***";
export class Database {
    constructor(databaseName, collectionName) {
        this.client = new MongoClient(uri);
        this.client.connect();
        if (databaseName) {
            this.database = this.client.db(databaseName);
            this.collection = this.database.collection(collectionName || "");
        }
        else {
            this.database = this.client.db('content');
            this.collection = this.database.collection('Maps');
        }
    }
    createSearchIndex() {
        this.collection.createIndex({ title: "text", "creators.username": "text", shortDescription: "text" });
    }
    executeQuery(query) {
        return this.collection.find(query.query).limit(query.limit).sort(query.sort).project(query.projection).skip(query.skip);
    }
}
export class DatabaseQueryBuilder {
    constructor(query, sort, projection, limit, skip) {
        this.query = query || {};
        this.sort = sort || {};
        this.projection = projection || {};
        this.limit = limit || 20;
        this.skip = skip || 0;
    }
    buildQuery(field, value) {
        this.query[field] = value;
    }
    buildQueryWithOperation(field, value, operation) {
        let operator = {};
        operator[operation] = value;
        this.query = { [field]: operator };
    }
    setQuery(query) {
        this.query = query;
    }
    buildSort(field, value) {
        this.sort = { [field]: value };
    }
    setSort(sort) {
        this.sort = sort;
    }
    setLimit(amount) {
        this.limit = amount;
    }
    setProjection(projection) {
        this.projection = projection;
    }
    setSkip(amount) {
        this.skip = amount;
    }
    createCopy() {
        return new DatabaseQueryBuilder(this.query, this.sort, this.projection, this.limit, this.skip);
    }
}
