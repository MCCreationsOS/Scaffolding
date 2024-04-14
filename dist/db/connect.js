import { MeiliSearch } from "meilisearch";
import { client } from "../index.js";
import { sendLog } from "../logging/logging.js";
const connectionsPool = [];
export class Database {
    constructor(databaseName, collectionName) {
        if (databaseName) {
            this.database = client.db(databaseName);
            this.collection = this.database.collection(collectionName || "");
        }
        else {
            this.database = client.db('content');
            this.collection = this.database.collection('Maps');
        }
        this.createSearchIndex();
    }
    createSearchIndex() {
        this.collection.createIndex({ title: "text", "creators.username": "text", shortDescription: "text" });
    }
    executeQuery(query) {
        let c = this.collection.find(query.query).limit(query.limit).sort(query.sort).project(query.projection).skip(query.skip);
        return c;
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
        this.query = Object.assign(Object.assign({}, this.query), { [field]: operator });
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
export class Search {
    constructor(query, sort, filter, hitsPerPage, page) {
        this.queryS = '';
        this.sortS = "createdDate:desc";
        (query) ? this.queryS = query : '';
        (sort) ? this.sortS = sort : '';
        this.filterS = filter;
        this.hitsPerPageS = hitsPerPage;
        this.pageS = page;
        try {
            this.client = new MeiliSearch({
                host: 'http://localhost:7700',
                apiKey: 'mccreations-search'
            });
            this.index = this.client.index('maps');
        }
        catch (error) {
            sendLog("Meilisearch", error);
            console.error(error);
        }
    }
    query(query, add) {
        this.queryS = add ? `${this.queryS} ${query}` : query;
    }
    sort(attr, direction) {
        this.sortS = `${attr}:${direction}`;
    }
    filter(attr, operation, value, combiner) {
        this.filterS = combiner ? `${this.filterS} ${combiner} ${attr}${operation}${value}` : `${attr} ${operation} ${value}`;
    }
    paginate(hitsPerPage, page) {
        this.hitsPerPageS = hitsPerPage;
        this.pageS = page;
    }
    execute() {
        if (!this.client || !this.index) {
            return;
        }
        let options = {};
        if (this.hitsPerPageS) {
            options.hitsPerPage = this.hitsPerPageS;
            options.page = this.pageS;
        }
        if (this.filterS) {
            options.filter = this.filterS;
        }
        if (this.sortS) {
            options.sort = [this.sortS];
        }
        return this.index.search(this.queryS, options);
    }
}
