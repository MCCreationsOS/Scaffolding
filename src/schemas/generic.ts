import { Kind, Static, TSchema, Type, TypeRegistry } from "@sinclair/typebox"
import { ObjectId } from "mongodb"

export const ErrorSchema = Type.Object({
    error: Type.String({description: "The error message"})
}, {description: "An error response"})

export const GenericResponse = <T extends TSchema>(schema: T) => Type.Object({
    200: schema,
    "4xx": ErrorSchema,
    "5xx": ErrorSchema
})

export type GenericResponseType<T extends TSchema> = Static<ReturnType<typeof GenericResponse<T>>>

export const WithCount = <T extends TSchema>(schema: T) => Type.Object({
    totalCount: Type.Number({description: "The total number of documents"}),
    documents: Type.Array(schema, {description: "The documents returned by the request"})
})

export type WithCountType<T extends TSchema> = Static<ReturnType<typeof WithCount<T>>>

export const Translatable = Type.Union([Type.String(), Type.Object({key: Type.String(), options: Type.Optional(Type.Any())})], {description: "A translatable string. If a string is provided, it will be used as is. If an object is provided, the key will be used to look up the string in the translations file and the options will be passed to it."})
export type Translatable = string | {key: string, options?: any}