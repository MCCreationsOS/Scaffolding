import { Document, Filter, Sort } from "mongodb"

export interface IDatabaseQuery {
    query: Filter<Document>,
    limit: number,
    skip: number,
    sort: Sort,
    projection: IDatabaseProjection
}

export interface MapDoc extends Document {
    comments: [{username?: string, comment?: string}],
    creators: [{username: string}],
    description: string,
    files: [{type: string, worldUrl: URL, resourceUrl?: URL, dataUrl?: URL, minecraftVersion: string, contentVersion?: string}]
    images: URL[],
    shortDescription: string,
    slug: string,
    status: number,
    title: string,
    videoUrl?: URL,
    downloads: number,
    views: number,
    rating: number,
    ratings?: number[]
    createdDate: Date,
    updatedDate: Date
}

export interface IDatabaseProjection {
    _id: number,
    title: number,
    "files.minecraftVersion": number,
    shortDescription: number,
    downloads: number,
    rating: 1,
    "creators.username": number,
    images: number,
    slug: number
}