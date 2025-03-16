import { ObjectId } from "mongodb";
import webpush from 'web-push'
import { notificationEmail } from "../email";
import { NotificationDocument } from "../database/models/notifications";
import { UserType } from "../schemas/user";
import { NotificationType } from "../database/models/notifications";
import { Database } from "../database";
import { Creation } from "../schemas/creation";
import { FullUser } from "../database/models/users";
import { getTranslation } from "../translation";
import { CronJob } from "schedule-jobs-with-cron";

webpush.setVapidDetails(
    'mailto:crazycowmm@gmail.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY + "",
    process.env.VAPID_PRIVATE_KEY + ""
)

export async function createNotification(options: {
    user: FullUser,
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
    creators: UserType[],
    link: string,
    title: string | {key: string, options?: any},
    body: string | {key: string, options?: any}
}) {
    let database = new Database<FullUser>("content", "creators")
    let creators = await database.collection.find({_id: {$in: options.creators.map(creator => creator._id!)}}).toArray()
    for(let creator of creators) {
        if(creator && creator.following) {
            for(let handle of creator.following) {
                let user = await database.collection.findOne({handle: handle})
                if(user) {
                    await createNotification({...options, user: user, type: "follow", createdByUser: creator.handle})
                }
            }
        }
    }
}

export async function createNotificationToCreators(options: {
    content: Creation,
    type: NotificationType,
    title: string | {key: string, options?: any},
    body: string | {key: string, options?: any},
    createdByUser?: string
}) {
    let creators = new Database("content", "creators")
    let users = await creators.collection.find<FullUser>({handle: {$in: options.content.creators?.map(creator => creator.handle) ?? []}}).toArray()
    users.forEach(async (user) => {
        await createNotification({...options, user: user, link: `/${options.content.type.toLowerCase()}/${options.content.slug}`, createdByUser: options.createdByUser})
    })
}

function sendNotification(notification: NotificationDocument, user: FullUser) {
    sendPushNotification(notification, user)
}

async function sendPushNotification(notification: NotificationDocument, user: FullUser) {
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

export async function subscribeToPushNotifications(user_id: string, subscription: webpush.PushSubscription) {
    let database = new Database<FullUser>("content", "creators")
    await database.collection.updateOne({_id: new ObjectId(user_id)}, {$push: {push_subscriptions: subscription}})
}

export async function sendDailyNotifications() {

    let database = new Database("content", "creators")
    let cursor = await database.collection.find<FullUser>({settings: {$exists: true}})
    for await(let user of cursor) {
        let settings = Object.keys(user.settings?.notifications ?? {})
        let send = false
        let toSend: string[] = []
        for(let setting of settings) {
            if(user.settings?.notifications[setting as keyof typeof user.settings.notifications].includes("email_daily")) {
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
    let cursor = await database.collection.find<FullUser>({settings: {$exists: true}})
    for await(let user of cursor) {
        let settings = Object.keys(user.settings?.notifications ?? {})
        let send = false
        let toSend: string[] = []
        for(let setting of settings) {
            if(user.settings?.notifications[setting as keyof typeof user.settings.notifications].includes("email_weekly")) {
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

new CronJob("dailyNotifications", sendDailyNotifications, "0 0 * * *")
new CronJob("weeklyNotifications", sendWeeklyNotifications, "0 0 * * 1")
