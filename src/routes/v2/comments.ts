import { Static, TVoid, Type } from "@sinclair/typebox";
import { Router } from "../router";
import { GenericResponseType, WithCount } from "../../schemas/generic";
import { Comment, CommentType } from "../../schemas/comment";
import { Database } from "../../database";
import { ObjectId } from "mongodb";
import { AuthorizationHeader } from '../../schemas/auth';
import { getUserFromJWT } from "../../auth/user";
import { UserTypes } from "../../schemas/user";
import { containsProfanity } from "../../utils/text";

const GetCommentsQuery = Type.Object({
    slug: Type.String(),
    content_type: CommentType
})

type GetCommentsQuery = Static<typeof GetCommentsQuery>

const WithCountComment = WithCount(Comment)

Router.app.get<{
    Querystring: GetCommentsQuery
    Reply: GenericResponseType<typeof WithCountComment>
}>("/comments", async (req, res) => {
    let database = new Database<Comment>("content", "comments")
    let query: any = {}
    if(req.query.slug) query.slug = req.query.slug
    if(req.query.content_type) query.content_type = req.query.content_type

    let comments = await database.collection.find(query).toArray()
    res.status(200).send({
        totalCount: comments.length,
        documents: comments
    })
})

Router.app.get<{
    Params: {
        id: string
    }
    Reply: GenericResponseType<typeof Comment>
}>("/comment/:id", async (req, res) => {
    let database = new Database<Comment>("content", "comments")
    let comment = await database.collection.findOne({_id: new ObjectId(req.params.id)})
    if(comment) {
        res.status(200).send(comment)
    } else {
        res.status(404).send({
            error: "Comment not found"
        })
    }
})

Router.app.post<{
    Body: Comment
    Reply: GenericResponseType<TVoid>
}>("/comment", async (req, res) => {

    if(containsProfanity(req.body.comment)) {
        req.body.approved = false
    }

    let database = new Database<Comment>("content", "comments")
    let comment = await database.collection.insertOne(req.body)
    if(comment.acknowledged) {
        res.status(200).send()
    } else {
        res.status(400).send({
            error: "Failed to create comment"
        })
    }
})

Router.app.delete<{
    Params: {
        id: string
    },
    Headers: AuthorizationHeader
}>("/comment/:id", async (req, res) => {
    if(req.headers.authorization.includes("Bearer")) {
        res.status(401).send({
            error: "Unauthorized"
        })
    }

    getUserFromJWT(req.headers.authorization).then(async (user) => {
        if(!user) {
            res.status(401).send({
                error: "Unauthorized"
            })
        }

        let database = new Database<Comment>("content", "comments")
        let comment = await database.collection.findOne({_id: new ObjectId(req.params.id)})
        if(!comment) {
            res.status(404).send({
                error: "Comment not found"
            })
        }

        if(comment?.handle !== user.handle && user.type !== UserTypes.Admin) {
            res.status(401).send({
                error: "Unauthorized"
            })
        }

        await database.collection.deleteOne({_id: new ObjectId(req.params.id)})
        res.status(200).send()
    }).catch((err) => {
        res.status(401).send({
            error: "Unauthorized"
        })
    })
})

Router.app.put<{
    Params: {
        id: string
    },
    Body: Comment
    Reply: GenericResponseType<TVoid>
    Headers: AuthorizationHeader
}>("/comment/:id", async (req, res) => {
    if(req.headers.authorization.includes("Bearer")) {
        res.status(401).send({
            error: "Unauthorized"
        })
    }

    getUserFromJWT(req.headers.authorization).then(async (user) => {
        if(!user) {
            res.status(401).send({
                error: "Unauthorized"
            })
        }

        let database = new Database<Comment>("content", "comments")
        let comment = await database.collection.findOne({_id: new ObjectId(req.params.id)})
        if(!comment) {
            res.status(404).send({
                error: "Comment not found"
            })
        }

        if(comment?.handle !== user.handle && user.type !== UserTypes.Admin) {
            res.status(401).send({
                error: "Unauthorized"
            })
        }

        if(containsProfanity(req.body.comment)) {
            req.body.approved = false
        } else {
            req.body.approved = true
        }

        req.body.updatedDate = Date.now()

        await database.collection.updateOne({_id: new ObjectId(req.params.id)}, {$set: req.body})
        res.status(200).send()
    }).catch((err) => {
        res.status(401).send({
            error: "Unauthorized"
        })
    })
})

Router.app.get<{
    Params: {
        id: string
    }
    Reply: GenericResponseType<TVoid>
}>("/comment/:id/like", async (req, res) => {
    let database = new Database<Comment>("content", "comments")
    let comment = await database.collection.findOne({_id: new ObjectId(req.params.id)})
    if(!comment) {
        res.status(404).send({
            error: "Comment not found"
        })
    }

    await database.collection.updateOne({_id: new ObjectId(req.params.id)}, {$inc: {likes: 1}})
    res.status(200).send()
})

Router.app.post<{
    Params: {
        id: string
    }
    Body: Comment
    Reply: GenericResponseType<TVoid>
}>("/comment/:id/reply", async (req, res) => {
    let database = new Database<Comment>("content", "comments")
    let comment = await database.collection.findOne({_id: new ObjectId(req.params.id)})
    if(!comment) {
        res.status(404).send({
            error: "Comment not found"
        })
    }

    if(containsProfanity(req.body.comment)) {
        req.body.approved = false
    } else {
        req.body.approved = true
    }

    req.body.createdDate = Date.now()

    await database.collection.updateOne({_id: new ObjectId(req.params.id)}, {$push: {replies: req.body}})
    res.status(200).send()
})