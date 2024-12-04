import { Static, Type } from "@sinclair/typebox"

export const AuthorizationHeader = Type.Object({
    authorization: Type.String()
})

export type AuthorizationHeader = Static<typeof AuthorizationHeader>