import { ObjectId } from "mongodb"

export interface User {
    _id?: ObjectId
    type: UserTypes
    username: string,
    email: string,
    password?: string,
    handle?: string,
    iconURL?: string
    about?: string,
    bannerURL?: string,
    socialLinks?: {
        link: string,
        name: string
    },
    providers?: Provider[]
}

export interface Provider {
    provider: Providers,
    token: string,
    refreshToken: string
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

export enum UserTypes {
    Account,
    Creator
}

export interface AuthError {
    error: string
}