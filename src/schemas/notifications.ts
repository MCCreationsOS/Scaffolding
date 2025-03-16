import { Static, Type } from "@sinclair/typebox";
import { ObjectId } from "mongodb";
import { Translatable } from "./generic";

export const NotificationType = Type.Enum({
    COMMENT: "comment",
    LIKE: "like",
    REPLY: "reply",
    FOLLOW: "follow",
    RATING: "rating",
    TRANSLATION: "translation"
}, {description: "The type of notification"})

export const TNotification = Type.Object({
    _id: Type.Unsafe<ObjectId>({description: "The ID of the notification"}),
    user_id: Type.Unsafe<ObjectId>({description: "The ID of the user that the notification is for"}),
    type: NotificationType,
    date: Type.Number({description: "The date the notification was created", format: "date-time"}),
    link: Type.String({description: "The link the user should be redirected to when they click the notification"}),
    read: Type.Boolean({description: "Whether the notification has been read"}),
    notified: Type.Boolean({description: "Whether the user has been notified about the notification"}),
    title: Translatable,
    body: Translatable,
    createdByUser: Type.Optional(Type.String({description: "The handle of the user that created the notification. Only present if the notification was created by another signed in user."}))
})

export type Notification = Static<typeof TNotification>