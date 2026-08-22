import { Static, Type } from "@sinclair/typebox"
import { ObjectId } from "mongodb"

export const TFile = Type.Object({
    _id: Type.Unsafe<ObjectId>(),
    filename: Type.Optional(Type.String()),
    name: Type.Optional(Type.String()),
    mimetype: Type.Optional(Type.String()),
    type: Type.Optional(Type.String()),
    location: Type.String(),
    user: Type.Optional(Type.Any())
})

export type File = Static<typeof TFile>

export const TFileUpdate = Type.Object({
    filename: Type.Optional(Type.String()),
    name: Type.Optional(Type.String()),
    mimetype: Type.Optional(Type.String()),
    type: Type.Optional(Type.String())
})

export type FileUpdate = Static<typeof TFileUpdate>
