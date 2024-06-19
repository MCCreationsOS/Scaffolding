import { Document, Filter, ObjectId, Sort } from "mongodb"

export interface IDatabaseQuery {
    query: Filter<Document>,
    limit: number,
    skip: number,
    sort: Sort,
    projection: IDatabaseProjection
}

export interface IInlineCreator {
    username: string,
    handle?: string

}

export interface ContentDocument extends Document {
    comments?: [{username?: string, comment?: string}],
    creators?: IInlineCreator[],
    slug: string,
    rating: number,
    ratings?: number[],
    createdDate: Date,
    updatedDate?: Date,
    _id?: ObjectId,
    tags?: string[],
    description: string,
    files?: File[]
    images: string[],
    shortDescription: string,
    status: number,
    title: string,
    videoUrl?: string,
    downloads: number,
    views: number,
    importedUrl?: string,
}

export interface File {
    type: string,
    worldUrl: string,
    resourceUrl?: string,
    dataUrl?: string,
    minecraftVersion: string,
    contentVersion?: string
    changelog?: string
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

export enum SearchIndex {
    Maps = "maps",
    Datapacks = "datapacks",
    Resourcepacks = "resourcepacks",
}

export enum DatabaseCollection {
    Maps = "Maps",
    Datapacks = "datapacks",
    Resourcepacks = "resourcepacks"
}