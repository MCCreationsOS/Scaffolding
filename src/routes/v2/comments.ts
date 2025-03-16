import { Static, TVoid, Type } from "@sinclair/typebox";
import { Router } from "../router";
import { GenericResponseType, WithCount } from "../../schemas/generic";
import { Comment, CommentType, TComment } from "../../schemas/comment";
import { Database } from "../../database";
import { ObjectId } from "mongodb";
import { AuthorizationHeader } from '../../schemas/auth';
import { _dangerouslyGetUnsanitizedUserFromHandle, processAuthorizationHeader } from "../../auth/user";
import { UserTypes } from "../../schemas/user";
import { containsProfanity } from "../../utils/text";
import { createNotification, createNotificationToCreators } from "../../notifications";
import { Creation } from "../../schemas/creation";
import { convertCommentTypeToCollectionName } from "../../utils/database";
import { NotificationType } from "../../schemas/notifications";

/**
 * Query for getting comments
 */
const GetCommentsQuery = Type.Object({
    slug: Type.String(),
    content_type: CommentType
})

type GetCommentsQuery = Static<typeof GetCommentsQuery>

/**
 * With count comment
 */
const WithCountComment = WithCount(TComment)

/**
 * Route for getting comments
 */
Router.app.get<{
    Querystring: GetCommentsQuery
    Reply: GenericResponseType<typeof WithCountComment>
}>("/comments", async (req, res) => {
    let database = new Database<Comment>("content", "comments")
    let query: any = {}
    if(req.query.slug) query.slug = req.query.slug
    if(req.query.content_type) query.content_type = req.query.content_type

    let comments = await database.find(query)
    return res.status(200).send({
        totalCount: comments.length,
        documents: comments
    })
})

/**
 * Route for getting a single comment by id
 */
Router.app.get<{
    Params: {
        id: string
    }
    Reply: GenericResponseType<typeof TComment>
}>("/comment/:id", async (req, res) => {
    let database = new Database<Comment>("content", "comments")
    let comment = await database.findOne({_id: new ObjectId(req.params.id)})
    if(comment) {
        return res.status(200).send(comment)
    } else {
        return res.status(404).send({
            error: "Comment not found"
        })
    }
})

/**
 * Route for creating a comment
 */
Router.app.post<{
    Body: Comment
    Reply: GenericResponseType<TVoid>
}>("/comment", async (req, res) => {

    if(containsProfanity(req.body.comment)) {
        req.body.approved = false
    } else {
        req.body.approved = true
    }

    let database = new Database<Comment>("content", "comments")
    let comment = await database.insertOne(req.body)
    if(comment.acknowledged) {
        res.status(200).send()
    } else {
        res.status(400).send({
            error: "Failed to create comment"
        })
        return;
    }

    let creations = new Database<Creation>(convertCommentTypeToCollectionName(req.body.content_type))
    let creation = await creations.findOne({slug: req.body.slug})
    if(creation && ((creation.owner !== req.body.handle && !creation.creators.map((creator) => creator.handle).includes(req.body.handle)) || !req.body.handle)) {
        console.log("Creating notification")
        createNotificationToCreators({
            content: creation,
            type: "comment",
            title: {key: "Account.Notifications.NewComment.title"},
            body: {key: "Account.Notifications.NewComment.body", options: {username: req.body.username, content_type: creation.type, title: creation.title}}
        })
    }
})

/**
 * Route for deleting a comment
 */
Router.app.delete<{
    Params: {
        id: string
    },
    Headers: AuthorizationHeader
}>("/comment/:id", async (req, res) => {
    if(req.headers.authorization.includes("Bearer")) {
        return res.status(401).send({
            error: "Unauthorized"
        })
    }

    // Check if the user is authorized
    processAuthorizationHeader(req.headers.authorization).then(async (user) => {
        if(!user) {
            return res.status(401).send({
                error: "Unauthorized"
            })
        }

        let database = new Database<Comment>("content", "comments")
        let comment = await database.findOne({_id: new ObjectId(req.params.id)})
        if(!comment) {
            return res.status(404).send({
                error: "Comment not found"
            })
        }

        if(comment?.handle !== user!.handle && user!.type !== UserTypes.Admin) {
            return res.status(401).send({
                error: "Unauthorized"
            })
        }

        await database.deleteOne({_id: new ObjectId(req.params.id)})
        res.status(200).send()
    }).catch((err) => {
        return res.status(401).send({
            error: "Unauthorized"
        })
    })
})

/**
 * Route for updating a comment
 */
Router.app.put<{
    Params: {
        id: string
    },
    Body: Comment
    Reply: GenericResponseType<TVoid>
    Headers: AuthorizationHeader
}>("/comment/:id", async (req, res) => {
    if(req.headers.authorization.includes("Bearer")) {
        return res.status(401).send({
            error: "Unauthorized"
        })
    }

    // Check if the user is authorized
    processAuthorizationHeader(req.headers.authorization).then(async (user) => {
        if(!user) {
            return res.status(401).send({
                error: "Unauthorized"
            })
        }

        let database = new Database<Comment>("content", "comments")
        let comment = await database.findOne({_id: new ObjectId(req.params.id)})
        if(!comment) {
            return res.status(404).send({
                error: "Comment not found"
            })
        }

        if(comment?.handle !== user!.handle && user!.type !== UserTypes.Admin) {
            return res.status(401).send({
                error: "Unauthorized"
            })
        }

        if(containsProfanity(req.body.comment)) {
            req.body.approved = false
        } else {
            req.body.approved = true
        }

        req.body.updatedDate = Date.now()

        await database.updateOne({_id: new ObjectId(req.params.id)}, {$set: req.body})
        res.status(200).send()
    }).catch((err) => {
        return res.status(401).send({
            error: "Unauthorized"
        })
    })
})

/**
 * Route for liking a comment
 */
Router.app.get<{
    Params: {
        id: string
    }
    Reply: GenericResponseType<TVoid>
}>("/comment/:id/like", async (req, res) => {
    let database = new Database<Comment>("content", "comments")
    let comment = await database.findOne({_id: new ObjectId(req.params.id)})
    if(!comment) {
        return res.status(404).send({
            error: "Comment not found"
        })
    }

    await database.updateOne({_id: new ObjectId(req.params.id)}, {$inc: {likes: 1}})
    return res.status(200).send()
})

/**
 * Route for replying to a comment
 */
Router.app.post<{
    Params: {
        id: string
    }
    Body: Comment
    Reply: GenericResponseType<TVoid>
}>("/comment/:id/reply", async (req, res) => {
    let database = new Database<Comment>("content", "comments")
    let comment = await database.findOne({_id: new ObjectId(req.params.id)})
    if(!comment) {
        return res.status(404).send({
            error: "Comment not found"
        })
    }

    if(containsProfanity(req.body.comment)) {
        req.body.approved = false
    } else {
        req.body.approved = true
    }

    req.body.createdDate = Date.now()

    await database.updateOne({_id: new ObjectId(req.params.id)}, {$push: {replies: req.body}})
    res.status(200).send()

    if(comment.handle && comment.handle !== req.body.handle) {
        let user = await _dangerouslyGetUnsanitizedUserFromHandle(comment.handle)
        if(user) {
            createNotification({
                user: user,
                type: "reply",
                title: {key: "Account.Notifications.NewReply.title"},
                body: {key: "Account.Notifications.NewReply.body", options: {username: req.body.username}},
                link: `/${comment.content_type.toLowerCase()}/${comment.slug}`
            })
        }
    }
})