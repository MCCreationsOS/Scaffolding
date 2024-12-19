import { Static, Type } from "@sinclair/typebox";
import { ObjectId } from "mongodb";

export enum UserTypes {
    Account,
    Creator,
    Admin
}

export const NotificationOption = Type.Union([Type.Literal("push_only"), Type.Literal("push_email_daily"), Type.Literal("push_email_weekly"), Type.Literal("email_daily"), Type.Literal("email_weekly"), Type.Literal("dashboard_only"), Type.Literal("none")])

export const SocialLink = Type.Object({
    link: Type.String(),
    name: Type.String()
})

export const ProfileLayout = Type.Object({
    widgets: Type.Array(Type.Any()),
    layout: Type.Array(Type.Any())
})

export const User = Type.Object({
    _id: Type.Unsafe<ObjectId>(),
    type: Type.Enum(UserTypes),
    username: Type.String(),
    email: Type.Lowercase(Type.String()),
    handle: Type.Lowercase(Type.Optional(Type.String())),
    iconURL: Type.Optional(Type.String()),
    bannerURL: Type.Optional(Type.String()),
    socialLinks: Type.Optional(Type.Array(SocialLink)),
    owners: Type.Optional(Type.Array(Type.String())),
    profileLayout: Type.Optional(ProfileLayout),
    settings: Type.Optional(Type.Object({
        notifications: Type.Object({
            comment: NotificationOption,
            like: NotificationOption,
            reply: NotificationOption,
            follow: NotificationOption,
            rating: NotificationOption,
            translation: NotificationOption
        })
    })),
    following: Type.Optional(Type.Array(Type.String())),
    followers: Type.Optional(Type.Array(Type.String()))
})

export type UserType = Static<typeof User>