import { Kind, Static, TSchema, Type, TypeRegistry } from "@sinclair/typebox"
import { ObjectId } from "mongodb"

export const GenericResponse = <T extends TSchema>(schema: T) => Type.Object({
    200: schema,
    "4xx": Type.Object({
        error: Type.String()
    })
})

export type GenericResponseType<T extends TSchema> = Static<ReturnType<typeof GenericResponse<T>>>

export const WithCount = <T extends TSchema>(schema: T) => Type.Object({
    totalCount: Type.Number(),
    documents: Type.Array(schema)
})

export type WithCountType<T extends TSchema> = Static<ReturnType<typeof WithCount<T>>>

