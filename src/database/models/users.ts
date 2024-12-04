import { UserType } from "../../schemas/user";

/**
 * The provider document
 */
export interface Provider {
    /**
     * The provider of the user
     */
    provider: Providers,
    /**
     * The token of the provider for said user
     */
    token: string,
    /**
     * The refresh token of the provider for said user
     */
    refreshToken: string,
    /**
     * The id of the user from the provider
     */
    id: string
}

export enum Providers {
    Discord,
    Google,
    Microsoft,
    Github,
    Steam,
    Apple
}

export interface FullUser extends UserType {
    providers: Provider[],
    password?: string,
    last_important_update?: Date,
}