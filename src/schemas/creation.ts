import { Static, Type } from "@sinclair/typebox";
import { User } from "./user";
import { ObjectId } from "mongodb";

export const TContentType = Type.Enum({
    MAP: "map",
    DATAPACK: "datapack",
    RESOURCEPACK: "resourcepack",
    MARKETPLACE: "marketplace"
})

export type ContentType = Static<typeof TContentType>

export const TCollectionName = Type.Enum({
    MAPS: "Maps",
    DATAPACKS: "datapacks",
    RESOURCEPACKS: "resourcepacks",
    MARKETPLACE: "marketplace"
})

export type CollectionName = Static<typeof TCollectionName>

export const TStatus = Type.Enum({
    DRAFT: 0,
    PENDING: 1,
    APPROVED: 2,
    FEATURED: 3,
    REJECTED: 4
})

export type Status = Static<typeof TStatus>

export const TFileType = Type.Enum({
    WORLD: "world",
    RESOURCE: "resource",
    DATA: "data",
    BEDROCK_WORLD: "bedrock_world",
    BEDROCK_RESOURCE: "bedrock_resource",
    BEDROCK_DATA: "bedrock_data",
    ADDON: "addon"
})

export type FileType = Static<typeof TFileType>

export const TExtraFile = Type.Object({
    type: TFileType,
    url: Type.String(),
    required: Type.Boolean()
})

export type ExtraFile = Static<typeof TExtraFile>

export const TFile = Type.Object({
    type: TFileType,
    url: Type.String(),
    worldUrl: Type.Optional(Type.String()),
    resourceUrl: Type.Optional(Type.String()),
    dataUrl: Type.Optional(Type.String()),
    minecraftVersion: Type.Array(Type.String()),
    contentVersion: Type.Optional(Type.String()),
    changelog: Type.Optional(Type.String()),
    extraFiles: Type.Optional(Type.Array(TExtraFile)),
    createdDate: Type.String()
})

export type File = Static<typeof TFile>

export const TCreation = Type.Object({
    _id: Type.Unsafe<ObjectId>(),
    title: Type.String(),
    type: TContentType,
    rating: Type.Number(),
    ratings: Type.Array(Type.Number()),
    createdDate: Type.String(),
    updatedDate: Type.String(),
    views: Type.Number(),
    downloads: Type.Number(),
    shortDescription: Type.String(),
    description: Type.String(),
    images: Type.Array(Type.String()),
    tags: Type.Array(Type.String()),
    videoUrl: Type.Optional(Type.String()),
    creators: Type.Array(User),
    slug: Type.String(),
    extraFeatures: Type.Optional(Type.Record(Type.String(), Type.Any())),
    files: Type.Optional(Type.Array(TFile)),
    importedUrl: Type.Optional(Type.String()),
    status: Type.Number(),
    owner: Type.Optional(Type.String())
})

export type Creation = Static<typeof TCreation>

export const TSort = Type.Enum({
    NEWEST: "newest",
    OLDEST: "oldest",
    UPDATED: "updated",
    TITLE_ASCENDING: "title_ascending",
    TITLE_DESCENDING: "title_descending",
    CREATOR_ASCENDING: "creator_ascending",
    CREATOR_DESCENDING: "creator_descending",
    HIGHEST_RATED: "highest_rated",
    LOWEST_RATED: "lowest_rated",
    MOST_DOWNLOADED: "most_downloaded",
    LEAST_DOWNLOADED: "least_downloaded"
})

export type Sort = Static<typeof TSort>