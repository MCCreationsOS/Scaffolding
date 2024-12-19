import { ObjectId } from "mongodb"

export type NotificationType = "comment" | "like" | "reply" | "follow" | "rating" | "translation"

export interface NotificationDocument {
    _id?: ObjectId,
    user_id: ObjectId,
    type: NotificationType,
    date: number,
    link: string
    read: boolean,
    notified: boolean,
    title: string | {key: string, options?: any},
    body: string | {key: string, options?: any},
    createdByUser?: string
}
