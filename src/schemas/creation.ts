import { Static, Type } from "@sinclair/typebox";
import { User } from "./user";
import { ObjectId } from "mongodb";

export const ContentType = Type.Enum({
    MAP: "map",
    DATAPACK: "datapack",
    RESOURCEPACK: "resourcepack"
})

export type ContentType = Static<typeof ContentType>

export const CollectionName = Type.Enum({
    MAPS: "Maps",
    DATAPACKS: "datapacks",
    RESOURCEPACKS: "resourcepacks",
    MARKETPLACE: "marketplace"
})

export type CollectionName = Static<typeof CollectionName>

export const Status = Type.Enum({
    DRAFT: 0,
    PENDING: 1,
    APPROVED: 2,
    FEATURED: 3,
    REJECTED: 4
})

export type Status = Static<typeof Status>

export const FileType = Type.Enum({
    WORLD: "world",
    RESOURCE: "resource",
    DATA: "data",
    BEDROCK_WORLD: "bedrock_world",
    BEDROCK_RESOURCE: "bedrock_resource",
    BEDROCK_DATA: "bedrock_data",
    ADDON: "addon"
})

export type FileType = Static<typeof FileType>

export const ExtraFile = Type.Object({
    type: FileType,
    url: Type.String(),
    required: Type.Boolean()
})

export type ExtraFile = Static<typeof ExtraFile>

export const File = Type.Object({
    type: FileType,
    url: Type.String(),
    worldUrl: Type.Optional(Type.String()),
    resourceUrl: Type.Optional(Type.String()),
    dataUrl: Type.Optional(Type.String()),
    minecraftVersion: Type.String(),
    contentVersion: Type.Optional(Type.String()),
    changelog: Type.Optional(Type.String()),
    extraFiles: Type.Optional(Type.Array(ExtraFile)),
    createdDate: Type.Number()
})

export type File = Static<typeof File>

export const Creation = Type.Object({
    _id: Type.Unsafe<ObjectId>(),
    title: Type.String(),
    contentType: ContentType,
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
    files: Type.Optional(Type.Array(File)),
    importedUrl: Type.Optional(Type.String()),
    status: Type.Number(),
    owner: Type.Optional(Type.String())
})

export type Creation = Static<typeof Creation>

export const Sort = Type.Enum({
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

export type Sort = Static<typeof Sort>