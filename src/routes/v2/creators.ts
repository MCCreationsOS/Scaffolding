import { GenericResponseType, WithCount } from "../../schemas/generic"
import { TVoid } from "@sinclair/typebox"
import { Router } from "../router"
import { User } from "../../schemas/user"
import { FullUser } from "../../database/models/users"
import { processAuthorizationHeader, sanitizeUser } from "../../auth/user"
import { Database } from "../../database"
import { Comment, TComment } from "../../schemas/comment"
import { AuthorizationHeader } from "../../schemas/auth"

const WithCountComment = WithCount(TComment)

const WithCountUser = WithCount(User)

Router.app.get<{
    Reply: GenericResponseType<typeof WithCountUser>,
    Querystring: {
        limit?: string,
        page?: string,
        search?: string,
    }
}>("/creators", async (req, res) => {
    let database = new Database<FullUser>("content", "creators")
    const pipeline: any[] = []
    if (req.query.search) {
        pipeline.push(
            {
                "$search": {
                    "index": "creators",
                    "text": {
                        "query": req.query.search,
                        "path": {
                            "wildcard": "*"
                        }
                    }
                }
            }
        )
    }

    pipeline.push(
        {
            "$limit": parseInt(req.query.limit ?? "20")
        },
        {
            "$skip": parseInt(req.query.page ?? "0") * parseInt(req.query.limit ?? "20")
        }
    )

    // let totalCount = await database.countDocuments(pipeline)

    let fullCreators = await database.collection.aggregate<FullUser>(pipeline).toArray()
    let creators = fullCreators.map(creator => sanitizeUser(creator))

    return res.status(200).send({
        totalCount: 0,
        documents: creators
    })
})
Router.app.get<{
    Reply: GenericResponseType<typeof User>
    Params: {
        handle: string
    },
    Headers: AuthorizationHeader
}>("/creator/:handle", async (req, res) => {
    let database = new Database<FullUser>("content", "creators")
    let user = await database.findOne({handle: req.params.handle})
    if (user) {
        return res.status(200).send(sanitizeUser(user, req.headers.authorization))
    } else {
        return res.status(404).send({error: "User not found"})
    }
})

Router.app.get<{
    Reply: GenericResponseType<typeof WithCountComment>
    Params: {
        handle: string
    }
}>("/creator/wall/:handle", async (req, res) => {
    let database = new Database<Comment>("content", "comments")
    let comments = await database.find({slug: req.params.handle, approved: true, content_type: "wall"})
    return res.status(200).send({
        totalCount: comments.length,
        documents: comments
    })
})

Router.app.get<{
    Params: {
        handle: string
    }
    Reply: GenericResponseType<TVoid>
    Headers: AuthorizationHeader
}>("/creator/follow/:handle", async (req, res) => {
    let user = await processAuthorizationHeader(req.headers.authorization + "")
    if (!user) {
        return res.status(401).send({ error: "Unauthorized" })
    }

    let database = new Database<FullUser>("content", "creators")
    await database.updateOne({handle: req.params.handle}, {$push: {followers: user._id.toString()}})
    await database.updateOne({_id: user._id}, {$push: {following: req.params.handle}})
    return res.status(200).send({})
})

Router.app.get<{
    Params: {
        handle: string
    }
    Reply: GenericResponseType<TVoid>
    Headers: AuthorizationHeader
}>("/creator/unfollow/:handle", async (req, res) => {
    let user = await processAuthorizationHeader(req.headers.authorization + "")
    if (!user) {
        return res.status(401).send({ error: "Unauthorized" })
    }

    let database = new Database<FullUser>("content", "creators")
    await database.updateOne({handle: req.params.handle}, {$pull: {followers: user._id.toString()}})
    await database.updateOne({_id: user._id}, {$pull: {following: req.params.handle}})
    return res.status(200).send({})
})