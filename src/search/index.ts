import { MeiliSearch, MultiSearchResponse } from "meilisearch"

import { Index } from "meilisearch"
import { Creation } from "../schemas/creation"
import { Database } from "../database"

export type SearchIndex  = "maps" | "datapacks" | "resourcepacks" | "marketplace"

export class Search {

    public static async initialize() {
        const client = new MeiliSearch({
            host: 'http://localhost:7700',
            apiKey: process.env.MEILISEARCH_KEY
        })

        const indexes = ["maps", "datapacks", "resourcepacks", "marketplace"]
        const maps = new Database("content", "Maps")
        const datapacks = new Database("content", "datapacks")
        const resourcepacks = new Database("content", "resourcepacks")
        const marketplace = new Database("content", "marketplace")

        const mapsCursor = maps.collection.find({})
        const datapacksCursor = datapacks.collection.find({})
        const resourcepacksCursor = resourcepacks.collection.find({})
        const marketplaceCursor = marketplace.collection.find({})

        for await (const doc of mapsCursor) {
            let timestampInMilliseconds = Date.parse(doc.createdDate);
            let timestamp = timestampInMilliseconds / 1000; 
            doc.createdDate = timestamp;

            timestampInMilliseconds = Date.parse(doc.updatedDate);
            timestamp = timestampInMilliseconds / 1000;
            doc.updatedDate = timestamp;
            client.index("maps").addDocuments([doc])
        }

        for await (const doc of datapacksCursor) {
            let timestampInMilliseconds = Date.parse(doc.createdDate);
            let timestamp = timestampInMilliseconds / 1000; 
            doc.createdDate = timestamp;

            timestampInMilliseconds = Date.parse(doc.updatedDate);
            timestamp = timestampInMilliseconds / 1000;
            doc.updatedDate = timestamp;
            client.index("datapacks").addDocuments([doc])
        }

        for await (const doc of resourcepacksCursor) {
            let timestampInMilliseconds = Date.parse(doc.createdDate);
            let timestamp = timestampInMilliseconds / 1000; 
            doc.createdDate = timestamp;

            timestampInMilliseconds = Date.parse(doc.updatedDate);
            timestamp = timestampInMilliseconds / 1000;
            doc.updatedDate = timestamp;
            client.index("resourcepacks").addDocuments([doc])
        }

        for await (const doc of marketplaceCursor) {
            let timestampInMilliseconds = Date.parse(doc.createdDate);
            let timestamp = timestampInMilliseconds / 1000; 
            doc.createdDate = timestamp;

            timestampInMilliseconds = Date.parse(doc.updatedDate);
            timestamp = timestampInMilliseconds / 1000;
            doc.updatedDate = timestamp;
            client.index("marketplace").addDocuments([doc])
        }

        indexes.forEach(index => {
            client.index(index).updateFilterableAttributes(["creators.handle", "tags", "files.minecraftVersion", "status"])
            client.index(index).updateSortableAttributes(["downloads", "rating", "createdDate", "updatedDate", "title", "creators.username"])
        })
    }

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
                apiKey: process.env.MEILISEARCH_KEY
            })

            indexes.forEach(index => {
                this.indexes.push(this.client!.index(index))
            })

        } catch (error) {
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

        documents.sort((a: Creation, b: Creation) => {
            switch(this.sortS) {
                case "createdDate:desc":
                    return new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()
                case "createdDate:asc":
                    return new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime()
                case "downloads:desc":
                    return b.downloads - a.downloads
                case "downloads:asc":
                    return a.downloads - b.downloads
                case "rating:desc":
                    return b.rating - a.rating
                case "rating:asc":
                    return a.rating - b.rating
                case "updatedDate:desc":
                    return new Date(b.updatedDate).getTime() - new Date(a.updatedDate).getTime()
                case "updatedDate:asc":
                    return new Date(a.updatedDate).getTime() - new Date(b.updatedDate).getTime()
                case "title:asc":
                    return a.title.localeCompare(b.title)
                case "title:desc":
                    return b.title.localeCompare(a.title)
                case "creators.username:asc":
                    return a.creators?.map(creator => creator.username).join(", ").localeCompare(b.creators?.map(creator => creator.username).join(", ") ?? "") ?? 0
                case "creators.username:desc":
                    return b.creators?.map(creator => creator.username).join(", ").localeCompare(a.creators?.map(creator => creator.username).join(", ") ?? "") ?? 0
                default:
                    return 0
            }
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
        console.log(this.sortS)
        try{
            let response = await this.client.multiSearch({queries: this.indexes.map(index => {return {indexUid: index.uid, q: this.queryS, ...options}})})
            
            return this.reformatResults(response)
        } catch (error) {
            console.error(error)
        }

    }
}