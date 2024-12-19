import { GenericResponseType, WithCount } from "../../schemas/generic"
import { TVoid, Type } from "@sinclair/typebox"
import { Router } from "../router"
import { User, UserType } from "../../schemas/user"
import { FullUser } from "../../database/models/users"
import { sanitizeUser } from "../../auth/user"
import { Database } from "../../database"

const WithCountUser = WithCount(User)

Router.app.get<{
    Reply: GenericResponseType<typeof WithCountUser>
}>("/creators", async (req, res) => {
    let database = new Database<FullUser>("content", "creators")
    let users = await database.collection.find().toArray()
    let sanitizedUsers: UserType[] = []
    users.forEach(user => {
        sanitizedUsers.push(sanitizeUser(user))
    })

    res.status(200).send({
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
    let user = await database.collection.findOne({handle: req.params.handle})
    if (user) {
        res.status(200).send(sanitizeUser(user))
    } else {
        res.status(404).send({error: "User not found"})
    }
})