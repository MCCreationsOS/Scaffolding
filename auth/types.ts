import { ObjectId } from "mongodb"

export interface User {
    _id?: ObjectId
    type: UserTypes
    username: string,
    email: string,
    password?: string,
    iconURL?: string | "https://next.mccreations.net/mcc_no_scaffold.png",
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
    message: string
}