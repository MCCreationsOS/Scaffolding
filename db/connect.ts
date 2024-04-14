import { MeiliSearch } from "meilisearch";
import { client } from "../index.js";
import { IDatabaseQuery, MapDoc } from "./types.js";

// const { MongoClient, ServerApiVersion } = require('mongodb');
import { Collection, Filter, MongoClient, ServerApiVersion, Sort, SortDirection, Document, FilterOperators } from 'mongodb';
import { sendLog } from "../logging/logging.js";


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
        this.query = {...this.query, [field]: operator}
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

export class Search {
    queryS = ''
    sortS = "createdDate:desc"
    filterS
    hitsPerPageS
    pageS
    private client
    private index

    constructor(query?: string, sort?: string, filter?: string, hitsPerPage?: number, page?: number) {
        (query) ? this.queryS = query : '';
        (sort) ? this.sortS = sort : '';
        this.filterS = filter;
        this.hitsPerPageS = hitsPerPage;
        this.pageS = page;

        try {
            this.client = new MeiliSearch({
                host: 'http://localhost:7700',
                apiKey: '***REMOVED***'
            })

            this.index = this.client.index('maps');

        } catch (error) {
            sendLog("Meilisearch", error)
            console.error(error)
        }

    }

    query(query: string, add: boolean) {
        this.queryS = add ? `${this.queryS} ${query}` : query;
    }

    sort(attr: string, direction: "asc" | "desc") {
        this.sortS = `${attr}:${direction}`;
    }

    filter(attr: string, operation: "=" | ">" | "<" | "!=" | "<=" | ">=", value: string | number, combiner?: "AND" | "OR") {
        this.filterS = combiner ? `${this.filterS} ${combiner} ${attr}${operation}${value}` : `${attr} ${operation} ${value}`;
    }

    paginate(hitsPerPage: number, page: number) {
        this.hitsPerPageS = hitsPerPage;
        this.pageS = page;
    }

    execute() {
        if(!this.client || !this.index) {
            return;
        }
        let options: any = {}

        if(this.hitsPerPageS) {
            options.hitsPerPage = this.hitsPerPageS;
            options.page = this.pageS
        }

        if(this.filterS) {
            options.filter = this.filterS;
        }

        if(this.sortS) {
            options.sort = [this.sortS];
        }

        return this.index.search(this.queryS, options)

    }
}