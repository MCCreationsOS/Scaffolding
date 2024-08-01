import { Index, MeiliSearch, MultiSearchResponse } from "meilisearch";
import { client } from "../index.js";
import { ContentDocument, IDatabaseQuery, SearchIndex } from "./types.js";

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
    private indexes: Index<Record<string, any>>[] = []

    constructor(indexes: SearchIndex[], query?: string, sort?: string, filter?: string, hitsPerPage?: number, page?: number) {
        (query) ? this.queryS = query : '';
        (sort) ? this.sortS = sort : '';
        this.filterS = filter;
        this.hitsPerPageS = hitsPerPage;
        this.pageS = page;

        try {
            this.client = new MeiliSearch({
                host: 'http://localhost:7700',
                apiKey: 'mccreations-search'
            })

            indexes.forEach(index => {
                this.indexes.push(this.client!.index(index))
            })

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

    reformatResults(response: MultiSearchResponse<Record<string, any>>) {
        let totalCount = 0;
        let documents: any[] = []
        response.results.forEach(res => {
            if(res.totalHits) {
                totalCount += res.totalHits;
            } else {
                totalCount += res.estimatedTotalHits!;
            }

            documents.push(...res.hits)
        })

        documents.sort((a, b) => {
            if(a.createdDate > b.createdDate) return -1;
            else return 1;
        })

        documents = documents.slice(0, this.hitsPerPageS)
        // if(totalCount > this.hitsPerPageS!) totalCount = this.hitsPerPageS!;
        return {totalCount, documents}
    }

    async execute() {
        if(!this.client || this.indexes.length === 0) {
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
        try{
            let response = await this.client.multiSearch({queries: this.indexes.map(index => {return {indexUid: index.uid, q: this.queryS, ...options}})})
            
            return this.reformatResults(response)
        } catch (error) {
            sendLog("Meilisearch", error)
            console.error(error)
        }

    }
}