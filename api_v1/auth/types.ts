import { ObjectId } from "mongodb"
import { CommentDocument } from "../db/types"

export type NotificationOption = "push_only" | "push_email_daily" | "push_email_weekly" | "email_daily" | "email_weekly" | "dashboard_only" | "none"

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
    providers?: Provider[],
    owners?: string[],
    last_important_update?: Date,
    profileLayout?: ProfileLayout,
    settings?: {
        notifications: {
            comment: NotificationOption,
            like: NotificationOption,
            reply: NotificationOption,
            subscription: NotificationOption,
            rating: NotificationOption,
            translation: NotificationOption
        }
    },
    push_subscriptions?: PushSubscription[],
    subscriptions?: string[],
    subscribers?: string[]
}

export interface WallPost {
    _id: string,
    comment: string,
    date: number
    comments: CommentDocument[]
}

export interface ProfileLayout {
    widgets: Widget[]
    layout: RGLayout[]
}

export interface Widget {
    type: string,
    id: string,
    data: any
}

export interface RGLayout {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number | undefined;
    maxW?: number | undefined;
    minH?: number | undefined;
    maxH?: number | undefined;
    moved?: boolean | undefined;
    static?: boolean | undefined;
    isDraggable?: boolean | undefined;
    isResizable?: boolean | undefined;
    resizeHandles?: ResizeHandle[] | undefined;
    isBounded?: boolean | undefined;
}

type ResizeHandle = "s" | "w" | "e" | "n" | "sw" | "nw" | "se" | "ne";

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
    Creator,
    Admin
}

export interface AuthError {
    error: string
    user?: User
}