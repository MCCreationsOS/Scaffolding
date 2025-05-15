import { Static, Type } from "@sinclair/typebox";
import { ObjectId } from "mongodb";

export const CommentType = Type.Enum({
    MAPS: "maps",
    DATAPACKS: "datapacks",
    RESOURCEPACKS: "resourcepacks",
    WALL: "wall"
})

export type CommentType = Static<typeof CommentType>

const SubComment = Type.Object({
    _id: Type.Unsafe<ObjectId>(),
    username: Type.String(),
    handle: Type.Optional(Type.String()),
    comment: Type.String(),
    date: Type.Number(),
    approved: Type.Boolean(),
    content_type: CommentType,
    slug: Type.String(),
    likes: Type.Number(),
    rating: Type.Optional(Type.Number())
})

export const TComment = Type.Object({
    ...SubComment.properties,
    replies: Type.Array(SubComment)
})

export type Comment = Static<typeof TComment>