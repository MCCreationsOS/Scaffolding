import { app } from "../index.js";
import { Database, DatabaseQueryBuilder } from "../db/connect.js";
import { rateContent } from "./rate.js";
import { User } from "../auth/types.js";
import * as words from 'naughty-words';

export function initializeCommunityRoutes() {
    app.get('/creators', async (req, res) => {
        let database = new Database('content', 'creators')
        let query = new DatabaseQueryBuilder();

        query.setProjection({
            password: 0,
            providers: 0
        })

        let cursor = await database.executeQuery(query)
        let documents = []
        let count = 0;
        for await (const doc of cursor) {
            documents.push(doc);
            count++;
        }
        let result = {
            totalCount: count,
            documents: documents
        }
        res.send(result);
    })

    app.get('/creator/:handle', async (req, res) => {
        let database = new Database('content', 'creators')
        let query = new DatabaseQueryBuilder();

        query.buildQuery("handle", req.params.handle)

        query.setProjection({
            password: 0,
            providers: 0,
            email: 0
        })

        let cursor = await database.executeQuery(query)
        res.send(await cursor.next());

    })

    app.post('/rate', async (req, res) => {
        let rating = await rateContent(Number.parseFloat(req.body.rating), req.body.map)
        res.send({rating: rating})
    })

    app.post('/maps/rate', async (req, res) => {
        let rating = await rateContent(Number.parseFloat(req.body.rating), req.body.map)
        res.send({message: "This route is out of date, please use /rate.", rating: rating})
    })
    
    app.post('/maps/comment/:slug', async (req, res) => {
        let database = new Database("content", req.body.content_type);
        let comments = new Database("content", "comments")

        let approved = true
        if(words.en.some((word) => req.body.comment.includes(word))) {
            approved = false
        }
    
        let comment = await comments.collection.insertOne({username: req.body.username, comment: req.body.comment, date: Date.now(), likes: 0, handle: req.body.handle, approved: approved, slug: req.params.slug})
        database.collection.updateOne({slug: req.params.slug}, {$push: {comments: {_id: comment.insertedId, username: req.body.username, comment: req.body.comment, date: Date.now(), likes: 0, handle: req.body.handle, approved: approved}}})
        res.sendStatus(200)
    })
}