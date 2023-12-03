import { Document, Filter, Sort } from "mongodb"

export interface IDatabaseQuery {
    query: Filter<Document>,
    limit: number,
    skip: number,
    sort: Sort,
    projection: IDatabaseProjection
}

export interface ContentDocument extends Document {
    comments: [{username?: string, comment?: string}],
    creators: [{username: string}],
    slug: string,
    rating: number,
    ratings?: number[],
    createdDate: Date,
    updatedDate: Date
}

export interface MapDoc extends ContentDocument {
    description: string,
    files: [{type: string, worldUrl: URL, resourceUrl?: URL, dataUrl?: URL, minecraftVersion: string, contentVersion?: string}]
    images: URL[],
    shortDescription: string,
    status: number,
    title: string,
    videoUrl?: URL,
    downloads: number,
    views: number,
}

export interface CreatorDocument extends Document {
    type: "account" | "creator",
    uid: string
}

export interface AccountDocument extends CreatorDocument {
    type: "account",
    creators: string[]
}

export interface TypeCreatorDocument extends CreatorDocument {
    type: "creator",
    displayName: string,
    photoUrl: URL,
    about: string,
    bannerUrl: URL,
    socialLinks: URL[]
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