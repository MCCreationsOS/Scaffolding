import { ObjectId } from "mongodb";
import { User } from "../auth/types";
import { Database } from "../db/connect";
import { ContentDocument, NotificationDocument, NotificationType } from "../db/types";
import webpush from 'web-push'
import { getTranslation } from "../translation";
import { notificationEmail } from "../email/email";

webpush.setVapidDetails(
    'mailto:crazycowmm@gmail.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY + "",
    process.env.VAPID_PRIVATE_KEY + ""
)

export async function createNotification(options: {
    user: User,
    type: NotificationType,
    link: string,
    title: string | {key: string, options?: any},
    body: string | {key: string, options?: any},
    createdByUser?: string
}) {
    let database = new Database("content", "notifications")
    let notification: NotificationDocument = {
        user_id: options.user._id!,
        type: options.type,
        date: Date.now(),
        link: options.link,
        read: false,
        notified: false,
        title: options.title,
        body: options.body,
        createdByUser: options.createdByUser
    }
    await database.collection.insertOne(notification)
    sendNotification(notification, options.user)
    return notification
}

export async function createNotificationsForSubscribers(options: {
    user: User,
    link: string,
    title: string | {key: string, options?: any},
    body: string | {key: string, options?: any}
}) {
    let database = new Database("content", "creators")
    let creator = await database.collection.findOne({_id: options.user._id!})
    if(creator && creator.following) {
        for(let user of creator.following) {
            await createNotification({...options, user: user, type: "follow", createdByUser: options.user.handle})
        }
    }
}

export async function createNotificationToCreators(options: {
    content: ContentDocument,
    type: NotificationType,
    title: string | {key: string, options?: any},
    body: string | {key: string, options?: any},
    createdByUser?: string
}) {
    let creators = new Database("content", "creators")
    let users = await creators.collection.find<User>({handle: {$in: options.content.creators?.map(creator => creator.handle) ?? []}}).toArray()
    users.forEach(async (user) => {
        await createNotification({...options, user: user, link: `/${options.content.type.toLowerCase()}/${options.content.slug}`, createdByUser: options.createdByUser})
    })
}

function sendNotification(notification: NotificationDocument, user: User) {
    sendPushNotification(notification, user)
}

async function sendPushNotification(notification: NotificationDocument, user: User) {
    let subscriptions = user.push_subscriptions

    if(!user.settings?.notifications[notification.type].includes("push")) {
        return
    }

    if(!subscriptions) {
        return
    }

    let payload = {
        title: (typeof notification.title === "string" ? notification.title : await getTranslation('en-US', notification.title.key, notification.title.options)),
        body: (typeof notification.body === "string" ? notification.body : await getTranslation('en-US', notification.body.key, notification.body.options)),
        icon: "/favicon.ico",
        link: notification.link
    }

    for(let subscription of subscriptions) {
        try {
            webpush.sendNotification(subscription, JSON.stringify(payload))
        } catch(e) {
            console.log(e)
        }
    }
}

export async function subscribeToPushNotifications(user_id: string, subscription: PushSubscription) {
    let database = new Database<User>("content", "creators")
    await database.collection.updateOne({_id: new ObjectId(user_id)}, {$push: {push_subscriptions: subscription}})
}

export async function sendDailyNotifications() {

    let database = new Database("content", "creators")
    let cursor = await database.collection.find<User>({settings: {$exists: true}})
    for await(let user of cursor) {
        let settings = Object.keys(user.settings?.notifications ?? {})
        let send = false
        let toSend: string[] = []
        for(let setting of settings) {
            if(user.settings?.notifications[setting].includes("email_daily")) {
                send = true
                toSend.push(setting)
            }
        }
        if(send) {
            let notifications = await database.collection.find<NotificationDocument>({user_id: user._id!, read: false, notified: false, type: {$in: toSend}}).toArray()
            if(notifications.length > 0) {
                database.collection.updateMany({user_id: user._id!, read: false, notified: false, type: {$in: toSend}}, {$set: {notified: true}})
                notificationEmail(user.email, notifications, "daily", toSend)
            }
        }
    }
}

export async function sendWeeklyNotifications() {

    let database = new Database("content", "creators")
    let cursor = await database.collection.find<User>({settings: {$exists: true}})
    for await(let user of cursor) {
        let settings = Object.keys(user.settings?.notifications ?? {})
        let send = false
        let toSend: string[] = []
        for(let setting of settings) {
            if(user.settings?.notifications[setting].includes("email_weekly")) {
                send = true
                toSend.push(setting)
            }
        }
        if(send) {
            let notifications = await database.collection.find<NotificationDocument>({user_id: user._id!, read: false, notified: false, type: {$in: toSend}}).toArray()
            if(notifications.length > 0) {
                database.collection.updateMany({user_id: user._id!, read: false, notified: false, type: {$in: toSend}}, {$set: {notified: true}})
                notificationEmail(user.email, notifications, "weekly", toSend)
            }
        }
    }
}