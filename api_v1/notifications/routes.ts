import { ObjectId } from "mongodb";
import { app } from "..";
import { getUserFromJWT } from "../auth/routes";
import { Database } from "../db/connect";
import { NotificationDocument } from "../db/types";
import { subscribeToPushNotifications } from ".";

export function initializeNotificationRoutes() {

    app.get('/notifications/:user_id', async (req, res) => {
        let user = await getUserFromJWT(req.headers.authorization + "")

        if(!user.user) {
            return res.sendStatus(401)
        }

        let database = new Database<NotificationDocument>('content', 'notifications')

        let page = parseInt(req.query.page as string) || 1
        let limit = parseInt(req.query.limit as string) || 20

        let notifications = await database.collection.find({user_id: user.user._id}).skip((page - 1) * limit).limit(limit).sort({date: -1}).toArray()
        res.send(notifications)
    })

    app.patch('/notification/:notification_id', async (req, res) => {
        let user = await getUserFromJWT(req.headers.authorization + "")

        if(!user.user) {
            return res.sendStatus(401)
        }

        let database = new Database<NotificationDocument>('content', 'notifications')
        let notification = await database.collection.findOne({_id: new ObjectId(req.params.notification_id), user_id: user.user._id})
        if(notification) {
            await database.collection.updateOne({_id: new ObjectId(req.params.notification_id)}, {$set: {read: true}})
            res.sendStatus(200)
        } else {
            res.sendStatus(404)
        }
    })

    app.patch('/notifications', async (req, res) => {
        let user = await getUserFromJWT(req.headers.authorization + "")

        if(!user.user) {
            return res.sendStatus(401)
        }

        let database = new Database<NotificationDocument>('content', 'notifications')
        await database.collection.updateMany({user_id: user.user._id, read: false}, {$set: {read: true}})
        res.sendStatus(200)
    })

    app.delete('/notification/:notification_id', async (req, res) => {
        let user = await getUserFromJWT(req.headers.authorization + "")

        if(!user.user) {
            return res.sendStatus(401)
        }
        
        let database = new Database<NotificationDocument>('content', 'notifications')
        let notification = await database.collection.findOne({_id: new ObjectId(req.params.notification_id), user_id: user.user._id})
        if(notification) {
            await database.collection.deleteOne({_id: new ObjectId(req.params.notification_id)})
            res.sendStatus(200)
        } else {
            res.sendStatus(404)
        }
    })

    app.post('/notifications/subscribe', async (req, res) => {
        let user = await getUserFromJWT(req.headers.authorization + "")
        if(!user.user) {
            return res.sendStatus(401)
        }

        await subscribeToPushNotifications(user.user._id + "", req.body)
        res.sendStatus(200)
    })
}