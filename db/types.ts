import { Document, Filter, Sort } from "mongodb"

export interface IDatabaseQuery {
    query: Filter<Document>,
    limit: number,
    skip: number,
    sort: Sort,
    projection: IDatabaseProjection
}

export interface ContentDocument extends Document {
    comments?: [{username?: string, comment?: string}],
    creators?: [{username: string, handle?: string}],
    slug: string,
    rating: number,
    ratings?: number[],
    createdDate: Date,
    updatedDate?: Date
}

export interface MapDoc extends ContentDocument {
    description: string,
    files?: [{type: string, worldUrl: string, resourceUrl?: string, dataUrl?: string, minecraftVersion: string, contentVersion?: string}]
    images: string[],
    shortDescription: string,
    status: number,
    title: string,
    videoUrl?: string,
    downloads: number,
    views: number,
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