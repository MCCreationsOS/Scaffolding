import { GenericResponseType, WithCount } from "../../schemas/generic"
import { TVoid, Type } from "@sinclair/typebox"
import { Router } from "../router"
import { User, UserType } from "../../schemas/user"
import { FullUser } from "../../database/models/users"
import { processAuthorizationHeader, sanitizeUser } from "../../auth/user"
import { Database } from "../../database"
import { Comment, TComment } from "../../schemas/comment"
import { AuthorizationHeader } from "../../schemas/auth"

const WithCountUser = WithCount(User)
const WithCountComment = WithCount(TComment)

Router.app.get<{
    Reply: GenericResponseType<typeof WithCountUser>
}>("/creators", async (req, res) => {
    let database = new Database<FullUser>("content", "creators")
    let users = await database.find({})
    let sanitizedUsers: UserType[] = []
    users.forEach(user => {
        sanitizedUsers.push(sanitizeUser(user))
    })

    return res.status(200).send({
        totalCount: users.length,
        documents: sanitizedUsers
    })
})

Router.app.get<{
    Reply: GenericResponseType<typeof User>
    Params: {
        handle: string
    }
}>("/creator/:handle", async (req, res) => {
    let database = new Database<FullUser>("content", "creators")
    let user = await database.findOne({handle: req.params.handle})
    if (user) {
        return res.status(200).send(sanitizeUser(user))
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