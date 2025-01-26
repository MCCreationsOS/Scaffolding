import { Static, Type } from "@sinclair/typebox";
import { ObjectId } from "mongodb";

export const NotificationType = Type.Enum({
    COMMENT: "comment",
    LIKE: "like",
    REPLY: "reply",
    FOLLOW: "follow",
    RATING: "rating",
    TRANSLATION: "translation"
})

export const TNotification = Type.Object({
    _id: Type.Unsafe<ObjectId>(),
    user_id: Type.Unsafe<ObjectId>(),
    type: NotificationType,
    date: Type.String(),
    link: Type.String(),
    read: Type.Boolean(),
    notified: Type.Boolean(),
    title: Type.Union([Type.String(), Type.Object({key: Type.String(), options: Type.Optional(Type.Any())})]),
    body: Type.Union([Type.String(), Type.Object({key: Type.String(), options: Type.Optional(Type.Any())})]),
    createdByUser: Type.Optional(Type.String())
})

export type Notification = Static<typeof TNotification>