import { ObjectId } from "mongodb"

export interface User {
    _id?: ObjectId
    username: string,
    email: string,
    password?: string,
    iconURL: string | "https://next.mccreations.net/mcc_no_scaffold.png",
    about?: string,
    bannerURL?: string,
    socialLinks?: {
        link: string,
        name: string
    },
    providers?: Providers[]
}

export enum Providers {
    Discord,
    Google,
    Microsoft,
    Github,
    Steam,
    Apple
}