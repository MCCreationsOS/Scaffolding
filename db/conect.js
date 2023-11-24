const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = "***REMOVED***";

export class Database {
    client = new MongoClient(uri).connect();
    database
    collection

    constructor(databaseName, collectionName) {
        client.connect();
        this.database = client.db(databaseName);
        this.collection = this.connection.collection(collectionName);
    }

    constructor() {
        client.connect();
        this.database = client.db('content');
        this.collection = this.connection.collection('Maps');
    }

    createSearchIndex() {
        this.maps.createIndex({title: "text", "creators.username": "text", shortDescription: "text"})
    }

    executeQuery(query) {
        return collection.find(query.query).limit(query.limit).sort(query.sort).project(query.projection).skip(query.skip);
    }
}

export class DatabaseQueryBuilder {
    query
    sort
    limit
    projection
    skip

    constructor() {
        this.query = {};
        this.sort = {};
        this.projection = {};
        this.limit = 20
        this.skip = 0
    }

    constructor(query, sort, projection, limit, skip) {
        this.query = query;
        this.sort = sort;
        this.projection = projection;
        this.limit = limit;
        this.skip = skip;
    }

    buildQuery(field, value) {
        this.query[field] = value;
    }

    buildQuery(field, value, operation) {
        this.query[field][operation] = value;
    }

    setQuery(query) {
        this.query = query;
    }

    buildSort(field, value) {
        this.sort[field] = value
    }

    buildSort(field, value, operation) {
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