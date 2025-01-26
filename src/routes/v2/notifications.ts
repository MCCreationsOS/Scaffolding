import { Router } from "../router";
import { AuthorizationHeader } from "../../schemas/auth";
import { GenericResponseType, WithCount } from "../../schemas/generic";
import { TNotification , Notification} from "../../schemas/notifications";
import { processAuthorizationHeader } from "../../auth/user";
import { Database } from "../../database";
import { ObjectId } from "mongodb";
import { TVoid } from "@sinclair/typebox";
import { PushSubscription } from "web-push";
import { subscribeToPushNotifications } from "../../notifications";

const WithCountNotification = WithCount(TNotification)

Router.app.get<{
    Reply: GenericResponseType<typeof WithCountNotification>
    Headers: AuthorizationHeader
}>("/notifications", async (req, res) => {
    let user = await processAuthorizationHeader(req.headers.authorization + "")
    if(!user) {
        return res.status(401).send({error: "Unauthorized"})
    }

    let database = new Database<Notification>("content", "notifications")

    let notifications = await database.find({user_id: user._id})

    return res.status(200).send({totalCount: notifications.length, documents: notifications})
})

Router.app.patch<{
    Params: {
        notification_id: string
    }
    Reply: GenericResponseType<TVoid>
    Headers: AuthorizationHeader
}>("/notifications/:notification_id", async (req, res) => {
    let user = await processAuthorizationHeader(req.headers.authorization + "")
    if(!user) {
        return res.status(401).send({error: "Unauthorized"})
    }

    let database = new Database<Notification>("content", "notifications")

    let notification = await database.findOne({_id: new ObjectId(req.params.notification_id), user_id: user._id})

    if(!notification) {
        return res.status(404).send({error: "Notification not found"})
    }

    await database.updateOne({_id: new ObjectId(req.params.notification_id)}, {$set: {read: true}})

    return res.status(200).send()
})

Router.app.patch<{
    Reply: GenericResponseType<TVoid>
    Headers: AuthorizationHeader
}>("/notifications", async (req, res) => {
    let user = await processAuthorizationHeader(req.headers.authorization + "")
    if(!user) {
        return res.status(401).send({error: "Unauthorized"})
    }

    let database = new Database<Notification>("content", "notifications")

    await database.collection.updateMany({user_id: user._id, read: false}, {$set: {read: true}})

    return res.status(200).send()
})

Router.app.delete<{
    Params: {
        notification_id: string
    }
    Reply: GenericResponseType<TVoid>
    Headers: AuthorizationHeader
}>("/notifications/:notification_id", async (req, res) => {
    let user = await processAuthorizationHeader(req.headers.authorization + "")
    if(!user) {
        return res.status(401).send({error: "Unauthorized"})
    }

    let database = new Database<Notification>("content", "notifications")

    let notification = await database.findOne({_id: new ObjectId(req.params.notification_id), user_id: user._id})

    if(!notification) {
        return res.status(404).send({error: "Notification not found"})
    }

    await database.deleteOne({_id: new ObjectId(req.params.notification_id)})

    return res.status(200).send()
})

Router.app.post<{
    Body: PushSubscription 
    Reply: GenericResponseType<TVoid>
    Headers: AuthorizationHeader
}>("/notifications/subscribe", async (req, res) => {
    let user = await processAuthorizationHeader(req.headers.authorization + "")
    if(!user) {
        return res.status(401).send({error: "Unauthorized"})
    }

    await subscribeToPushNotifications(user._id + "", req.body)

    return res.status(200).send()
})
