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
    type: string,
    extraFeatures?: {[key in "leaderboards" | "translations" | "indexing"]: boolean | LeaderboardFeature},
}

export interface LeaderboardFeature {
    use: boolean,
    message: string,
    messageFormatting: string,
}

export interface File {
    type: string,
    url?: string,
    worldUrl?: string,
    resourceUrl?: string,
    dataUrl?: string,
    minecraftVersion: string,
    contentVersion?: string
    changelog?: string,
    extraFiles?: NewFile[],
    createdDate: number,
}

export interface NewFile {
    type: string,
    url: string,
    required: boolean,
}

export interface CommentDocument {
    _id: ObjectId,
    username: string,
    comment: string,
    date: number,
    likes: number,
    handle: string,
    approved: boolean,
    slug: string
    content_type: "Maps" | "datapacks" | "resourcepacks" | "wall"
    replies?: CommentDocument[]
    like_senders?: string[]
}

export type NotificationType = "comment" | "like" | "reply" | "follow" | "rating" | "translation"

export interface NotificationDocument {
    _id?: ObjectId,
    user_id: ObjectId,
    type: NotificationType,
    date: number,
    link: string
    read: boolean,
    notified: boolean,
    title: string | {key: string, options?: any},
    body: string | {key: string, options?: any},
    createdByUser?: string
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
    Marketplace = "marketplace"
}

export enum DatabaseCollection {
    Maps = "Maps",
    Datapacks = "datapacks",
    Resourcepacks = "resourcepacks",
    Marketplace = "marketplace"
}
