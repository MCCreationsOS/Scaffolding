import { Static, TSchema, Type } from "@sinclair/typebox"

export const GenericResponse = <T extends TSchema>(schema: T) => Type.Object({
    200: schema,
    "4xx": Type.Object({
        error: Type.String()
    })
})

export type GenericResponseType<T extends TSchema> = Static<ReturnType<typeof GenericResponse<T>>>