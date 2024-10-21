import { app } from "../index.js";
import { Database, DatabaseQueryBuilder } from "../db/connect.js";
import { rateContent } from "./rate.js";
import { User, UserTypes } from "../auth/types.js";
import * as words from 'naughty-words';
import { CommentDocument, ContentDocument } from "../db/types.js";
import { getUserFromJWT } from "../auth/routes.js";
import { ObjectId } from "mongodb";
import FormData from "form-data";
import { createReadStream, writeFileSync } from "fs";
import { createNotification, createNotificationToCreators } from "../notifications/index.js";

export function initializeCommunityRoutes() {
    app.get('/creators', async (req, res) => {
        let database = new Database<User>('content', 'creators')
        let query = new DatabaseQueryBuilder();

        query.setProjection({
            password: 0,
            providers: 0
        })

        let cursor = await database.executeQuery(query)
        let documents: any[] = []
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
        let database = new Database<User>('content', 'creators')
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

    app.post('/translation', async (req, res) => {
        console.log(req.body)
        writeFileSync('t.json', JSON.stringify(req.body, undefined, 4))

        const form = new FormData();
        form.append('payload_json', JSON.stringify({
            "content": "New Translation: ",
            "attachments": [{id: 0}]
        }))
        form.append('files[0]', createReadStream('t.json'))

        form.submit(process.env.DISCORD_UPDATE_WEBHOOK_URL + "")
        res.sendStatus(200)
    })

    app.get('/leaderboards/:type/:slug', async (req, res) => {
        let database = new Database("content", "leaderboards")
        let query = new DatabaseQueryBuilder();
        query.buildQuery("slug", req.params.slug)
        query.buildQuery("type", req.params.type)
        let leaderboard = await database.collection.findOne(query.query)
        res.send(leaderboard)
    })

    app.post('/leaderboards/:type/:slug', async (req, res) => {
        let database = new Database("content", "leaderboards")
        let query = new DatabaseQueryBuilder();
        query.buildQuery("slug", req.params.slug)
        query.buildQuery("type", req.params.type)
        let leaderboard = await database.collection.findOne(query.query)

        let user = await getUserFromJWT(req.headers.authorization + "")

        let score = {
            username: req.body.username,
            handle: user.user?.handle,
            score: req.body.score,
            date: Date.now(),
            device: req.headers['user-agent']?.includes("Macintosh") ? "Mac" : "Windows",
            location: req.headers['cf-ipcountry'],
            score_type: req.body.score_type
        }

        if(leaderboard) {
            await database.collection.updateOne(query.query, {$push: {scores: score}})
        } else {
            await database.collection.insertOne({slug: req.params.slug, type: req.params.type, scores: [score]})
        }
        res.sendStatus(200)
    })
    
    app.post('/content/comment/:slug', async (req, res) => {
        let comments = new Database("content", "comments")

        let approved = true
        if(words.en.some((word) => req.body.comment.includes(` ${word} `))) {
            approved = false
        }

        const comment = {
            username: req.body.username,
            comment: req.body.comment,
            date: Date.now(),
            likes: 0,
            handle: req.body.handle,
            approved: approved,
            slug: req.params.slug,
            content_type: req.body.content_type
        }
    
        await comments.collection.insertOne(comment)

        res.sendStatus(200)

        let contentDatabase = new Database("content", req.body.content_type)
        let content = await contentDatabase.collection.findOne<ContentDocument>({slug: req.params.slug})

        if(content) {
            createNotificationToCreators({
                content: content,
                type: "comment",
                title: {key: "Account.Notifications.NewComment.title"},
                body: {key: "Account.Notifications.NewComment.body", options: {content_type: content.type, username: req.body.username, title: content.title}},
                createdByUser: req.body.handle
            })
        }
    })

    app.post('/content/comment_like', async (req, res) => {
        let database = new Database("content", "comments")
        let comment = await database.collection.findOne({_id: new ObjectId(req.body.comment_id)})

        if(comment) {
            let user = await getUserFromJWT(req.headers.authorization + "")
            if(comment.like_senders?.includes(user.user?.handle)) {
                res.sendStatus(400)
                return;
            } else if (user.user) {
                if(!comment.like_senders) comment.like_senders = []
                comment.like_senders?.push(user.user?.handle)
            } else if (comment.like_senders?.includes(req.ip)) {
                res.sendStatus(400)
                return;
            } else {
                if(!comment.like_senders) comment.like_senders = []
                comment.like_senders?.push(req.ip)
            }
            await database.collection.updateOne({_id: comment._id}, {$set: {likes: comment.likes + 1, like_senders: comment.like_senders}})
            res.sendStatus(200)
        } else {
            res.sendStatus(404)
        }
    })

    app.post('/content/comment_reply', async (req, res) => {
        let database = new Database("content", "comments")
        let comment = await database.collection.findOne({_id: new ObjectId(req.body.comment_id)})

        let approved = true
        if(words.en.some((word) => req.body.reply.includes(` ${word} `))) {
            approved = false
        }

        let reply = {
            username: req.body.username,
            comment: req.body.reply,
            handle: req.body.handle,
            date: Date.now(),
            approved: approved
        }

        if(comment) {
            await database.collection.updateOne({_id: comment._id}, {$push: {replies: reply}})
            res.sendStatus(200)

            if(comment.handle !== reply.handle && comment.handle) {
                let users = new Database("content", "creators")
                let user = await users.collection.findOne<User>({handle: comment.handle})
                if(user) {
                    createNotification({
                        user: user,
                        type: "reply",
                        link: `/${comment.content_type.toLowerCase()}/${comment.slug}`,
                        title: {key: "Account.Notifications.NewReply.title"},
                        body: {key: "Account.Notifications.NewReply.body", options: {username: reply.username}},
                        createdByUser: reply.handle
                    })
                }
            }

        } else {
            res.sendStatus(404)
        }
    })

    app.get('/content/comments/:slug', async (req, res) => {
        let database = new Database("content", "comments")
        
        let comments = await database.collection.find({slug: req.params.slug, content_type: req.query.content_type, approved: true}).toArray()
        res.send(comments)
    })

    app.get('/content/comment/:id', async (req, res) => {
        let database = new Database("content", "comments")
        let comment = await database.collection.findOne({_id: new ObjectId(req.params.id)})
        res.send(comment)
    })

    app.delete('/content/comment/:id', async (req, res) => {
        let user = await getUserFromJWT(req.headers.authorization + "")
        let database = new Database("content", "comments")
        let comment = await database.collection.findOne({_id: new ObjectId(req.params.id)})
        if(comment && (comment.handle && comment.handle === user.user?.handle) || user.user?.type === UserTypes.Admin) {
            await database.collection.deleteOne({_id: new ObjectId(req.params.id)})
        }
        res.sendStatus(200)
    })

    app.post('/content/comments/update', async (req, res) => {
        let database = new Database("content", "comments")
        let query = new DatabaseQueryBuilder();
        query.buildQuery("_id", req.body._id)
        let comment = await database.collection.findOne(query.query)
        let user = await getUserFromJWT(req.headers.authorization + "")

        if(comment && (comment.handle && comment.handle === user.user?.handle) || user.user?.type === UserTypes.Admin) {
            await database.collection.updateOne(query.query, {$set: {comment: req.body.comment}})
        }

        res.sendStatus(200)
    })

    app.get('/content/comments-nosearch', async (req, res) => {
        let database = new Database("content", "comments")
        let query = new DatabaseQueryBuilder();
        const requestQuery : any = req.query;

        switch(requestQuery.sort) {
            case "newest":
                query.buildSort("date", -1)
                break;
            case "oldest":
                query.buildSort("date", 1)
                break;
            case "highest_rated": 
                query.buildSort("rating", -1)
                break;
            case "lowest_rated":
                query.buildSort("rating", 1)
                break;
            case "creator_ascending":
                query.buildSort("username", 1)
                break;
            case "creator_descending":
                query.buildSort("username", -1)
                break;
            // case "best_match": 
            // 	sort = {score: {$meta: "textScore"}}
            // 	break;
            default:
                query.buildSort("date", -1)
        }

        if (requestQuery.approved) {
            console.log(requestQuery.approved)
            query.buildQuery("approved", JSON.parse(requestQuery.approved))
        }

        if(requestQuery.slug) {
            console.log(requestQuery.slug)
            query.buildQuery("slug", requestQuery.slug as string)
        }

        if(requestQuery.limit) {
            query.setLimit(Number.parseInt(requestQuery.limit))
        } else {
            query.setLimit(20)
        }

        if(query.limit === 0) {
            query.setLimit(20)
        }

        if(requestQuery.page) {
            if(requestQuery.page < 0) {
                requestQuery.page = "0"
            }
            query.setSkip(Number.parseInt(requestQuery.page) * query.limit);
        }

        if(requestQuery.creator) {
            query.buildQuery("handle", requestQuery.creator)
        }

        let count = await database.collection.countDocuments(query.query)

        let cursor = database.executeQuery(query);

        let documents: any[] = []
        for await (const doc of cursor) {
            documents.push(doc);
        }
        let result: {totalCount: number, documents: CommentDocument[]} = {
            totalCount: count,
            documents: documents as CommentDocument[]
        }
        res.send(result);
    })
}

export async function sendCommentsDigest() {
    let database = new Database("content", "comments")
    let comments = await database.collection.find({date: {$gt: Date.now() - 1000 * 60 * 60 * 24}}).toArray()

    const unapprovedComments = comments.filter((comment) => !comment.approved)

    if(comments.length === 0) return;
    fetch(process.env.DISCORD_UPDATE_WEBHOOK_URL + "", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            content: "There are " + unapprovedComments.length + " unapproved comments waiting for review at https://www.mccreations.net/admin_dashboard."
        })
    
    })
}