import * as words from 'naughty-words';
import { getUserFromJWT } from "../auth/routes.js";
import { Database } from "../db/connect.js";
import { app } from "../index.js";
import { ObjectId } from 'mongodb';
import { createNotification } from '../notifications/index.js';

export function initializeCreatorRoutes() {
    app.get('/creator/:handle', async (req, res) => {
        let database = new Database("content", "creators")
        let creator = await database.collection.findOne({handle: req.params.handle})
        res.send(creator);
    })

    app.get('/creator/wall/:handle', async (req, res) => {
        let database = new Database("content", "comments")
        let comments = await database.collection.find({slug: req.params.handle, approved: true, content_type: "wall"})
        res.send(await comments.toArray())
    })

    app.post('/creator/subscribe', async (req, res) => {
        let user = await getUserFromJWT(req.headers.authorization + "")
        if(!user || !user.user) {
            res.sendStatus(401)
            return;
        }

        let database = new Database("content", "creators")
        await database.collection.updateOne({handle: req.body.handle}, {$push: {subscribers: user.user._id}})

        await database.collection.updateOne({_id: user.user._id}, {$push: {subscriptions: req.body.handle}})
        res.sendStatus(200)
    })

    app.post('/creator/unsubscribe', async (req, res) => {
        let user = await getUserFromJWT(req.headers.authorization + "")
        if(!user || !user.user) {
            res.sendStatus(401)
            return;
        }

        let database = new Database("content", "creators")
        await database.collection.updateOne({handle: req.body.handle}, {$pull: {subscribers: user.user._id}})

        await database.collection.updateOne({_id: user.user._id}, {$pull: {subscriptions: req.body.handle}})
        res.sendStatus(200)
    })
}