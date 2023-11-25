"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseQueryBuilder = exports.Database = void 0;
const { MongoClient, ServerApiVersion } = require('mongodb');
// import { MongoClient, ServerApiVersion } from 'mongodb';
const uri = "***REMOVED***";
class Database {
    constructor(databaseName, collectionName) {
        this.client = new MongoClient(uri).connect();
        this.client.connect();
        if (databaseName) {
            this.database = this.client.db(databaseName);
            this.collection = this.client.collection(collectionName);
        }
        else {
            this.database = this.client.db('content');
            this.collection = this.client.collection('Maps');
        }
    }
    createSearchIndex() {
        this.collection.createIndex({ title: "text", "creators.username": "text", shortDescription: "text" });
    }
    executeQuery(query) {
        return this.collection.find(query.query).limit(query.limit).sort(query.sort).project(query.projection).skip(query.skip);
    }
}
exports.Database = Database;
class DatabaseQueryBuilder {
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
        this.query[field][operation] = value;
    }
    setQuery(query) {
        this.query = query;
    }
    buildSort(field, value) {
        this.sort[field] = value;
    }
    buildSortWithOperation(field, value, operation) {
        this.sort[field][operation] = value;
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
exports.DatabaseQueryBuilder = DatabaseQueryBuilder;
