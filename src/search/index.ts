import { MeiliSearch, MultiSearchResponse } from "meilisearch"

import { Index } from "meilisearch"
import { ContentType, Creation } from "../schemas/creation"
import { Database } from "../database"

export type SearchIndex  = "maps" | "datapacks" | "resourcepacks" | "marketplace"

export interface FilterObject {
    key: string,
    operation: "=" | ">" | "<" | "!=" | "<=" | ">=" | "TO" | "EXISTS" | "IN",
    value: string | number | string[],
    combiner?: "AND" | "OR"
}

export interface Filter {
    filter: FilterObject | FilterObject[]
    combiner?: "AND" | "OR"
}

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
            client.index(index).updateFilterableAttributes(["creators.handle", "tags", "files.minecraftVersion", "status", "owner"])
            client.index(index).updateSortableAttributes(["downloads", "rating", "createdDate", "updatedDate", "title", "creators.username"])
        })
    }

    queryS = ''
    sortS = "createdDate:desc"
    filters: Filter[] = []
    hitsPerPageS
    pageS
    private client
    private indexes: Index<Record<string, any>>[] = []

    constructor(indexes: SearchIndex[], query?: string, sort?: string, filters?: Filter[], hitsPerPage?: number, page?: number) {
        (query) ? this.queryS = query : '';
        (sort) ? this.sortS = sort : '';
        this.filters = filters ?? [];
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

    filter(filter: Filter) {
        this.filters.push(filter)
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

        if(this.filters.length > 0) {
            let filterStrings = this.filters.map((filter, index) => {
                if(Array.isArray(filter.filter)) {
                    return `(${filter.filter.map((f, i) => {
                        // @ts-ignore
                        return ` ${f.key} ${f.operation} ${f.value} ${i === filter.filter.length - 1 ? "" : f.combiner ?? "OR"}`
                    }).join(" ")}) ${filter.combiner && index === this.filters.length - 1 ? "" : filter.combiner ?? "OR"}`
                } else {
                    return ` ${filter.filter.key} ${filter.filter.operation} ${filter.filter.value} ${index === this.filters.length - 1 ? "" : filter.filter.combiner ?? "OR"} `
                }
            })
            options.filter = filterStrings.join(" ")
        }
        console.log(options.filter)

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

    async addDocument(document: Creation) {
        this.indexes.forEach(index => {
            index.addDocuments([document])
        })
    }

    async updateDocument(document: Creation) {
        this.indexes.forEach(index => {
            index.updateDocuments([document])
        })
    }

    async deleteDocument(document: Creation) {
        this.indexes.forEach(index => {
            index.deleteDocuments([document._id.toString()])
        })
    }
}

export function convertContentTypeToSearchIndex(contentType: ContentType): SearchIndex {
    switch(contentType) {
        case "map":
            return "maps"
        case "datapack":
            return "datapacks"
        case "resourcepack":
            return "resourcepacks"
        case "marketplace":
            return "marketplace"
    }
}

