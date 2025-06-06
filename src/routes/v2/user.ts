
import { Static, TVoid, Type } from "@sinclair/typebox";
import { _dangerouslyGetUnsanitizedUserFromJWT, bcryptHash, createJWT, getDiscordAccessToken, getDiscordUser, getGithubAccessToken, getGithubUser, getGoogleUser, getMicrosoftAccessToken, getMicrosoftUser, processAuthorizationHeader } from "../../auth/user";
import { CollectionName, Database } from "../../database";
import { NotificationOption, ProfileLayout, User } from "../../schemas/user";
import { Router } from "../router";
import { AuthorizationHeader } from "../../schemas/auth";
import { ErrorSchema, GenericResponseType, WithCount } from "../../schemas/generic";
import { Providers } from "../../database/models/users";
import { forgotPasswordEmail } from "../../email";
import { TCreation } from "../../schemas/creation";
import { Search } from "../../search";

Router.app.get<{ 
    Reply: GenericResponseType<typeof User>, 
    Headers: AuthorizationHeader 
}>("/user", async (req, res) => {
        let user = await processAuthorizationHeader(req.headers.authorization, true)
        if(!user) {
        return res.code(401).send({error: "Unauthorized"})
    }
    return res.code(200).send(user)
})

const TUserSettings = Type.Object({
    settings: Type.Object({
        notifications: Type.Object({
            comment: NotificationOption,
            like: NotificationOption,
            reply: NotificationOption,
            follow: NotificationOption,
            rating: NotificationOption,
            translation: NotificationOption
        })
    }),
    push_subscriptions: Type.Array(Type.Object({
        endpoint: Type.String(),
        keys: Type.Object({
            auth: Type.String(),
            p256dh: Type.String()
        })
    }))
})

Router.app.get<{
    Reply: GenericResponseType<typeof TUserSettings>
    Headers: AuthorizationHeader
}>("/user/settings", async (req, res) => {
    let user = await _dangerouslyGetUnsanitizedUserFromJWT(req.headers.authorization)
    if(!user) {
        return res.code(401).send({error: "Unauthorized"})
    }
    return res.code(200).send({settings: user.settings!, push_subscriptions: user.push_subscriptions ?? []})
})

const WithCountFeed = WithCount(TCreation)

Router.app.get<{
    Querystring: {
        limit?: string
        page?: string
    }
    Reply: GenericResponseType<typeof WithCountFeed>
    Headers: AuthorizationHeader
}>("/feed", async (req, res) => {
    let user = await processAuthorizationHeader(req.headers.authorization)
    if(!user) {
        return res.code(401).send({error: "Unauthorized"})
    }
    
    if(!user.following || user.following.length === 0) {
        return res.code(200).send({totalCount: 0, documents: []})
    }

    const search = new Search(["maps", "resourcepacks", "datapacks"])
    search.filter({filter: [{key: "creators.handle", operation: "IN", value: user.following}, {key: "status", operation: ">=", value: 1, combiner: "AND"}]})
    search.paginate(parseInt(req.query.limit ?? "20"), parseInt(req.query.page ?? "0") + 1)
    let documents = await search.execute()

    const database = new Database("content", "comments")
    const comments = await database.collection.find({handle: {$in: user.following}, approved: true, content_type: "wall"}).toArray()

    const feed = [...documents?.documents ?? [], ...comments]
    feed.sort((a, b) => {
        return (b['createdDate'] ?? b['date']) - (a['createdDate'] ?? a['date'])
    })

    if(!documents) {
        return res.code(400).send({error: "Failed to fetch feed"})
    }
    return res.code(200).send({totalCount: feed.length, documents: feed})
})

Router.app.delete<{ 
    Headers: AuthorizationHeader, 
    Reply: GenericResponseType<TVoid> 
}>("/user", async (req, res) => {
    processAuthorizationHeader(req.headers.authorization).then( async (user) => {
        if(!user) {
            return res.code(401).send({error: "Unauthorized"})
        }
        if(user._id) {
            let database = new Database("content", "creators")
            let result = await database.collection.deleteOne({_id: user._id})
            if(result.acknowledged && result.deletedCount === 1) {
                return res.code(200).send()
            } else {
                return res.code(400).send({error: "User not found"})
            }
        } else {
            return res.code(400).send({error: "User not found"})
        }
    }).catch((err) => {
        return res.code(401).send({error: "Unauthorized"})
    })
})

const UpdateProfileSchema = Type.Object({
    username: Type.String(),
    icon: Type.String(),
    banner: Type.String()
})

type UpdateProfileBody = Static<typeof UpdateProfileSchema>

Router.app.post<{ 
    Body: UpdateProfileBody, 
    Headers: AuthorizationHeader, 
    Reply: GenericResponseType<TVoid> 
}>("/user/updateProfile", async (req, res) => {
    if(req.headers.authorization.startsWith("Bearer ")) {
        return res.code(401).send({error: "Unauthorized"})
    }
    processAuthorizationHeader(req.headers.authorization).then(async (user) => {
        if(!user) {
            return res.code(401).send({error: "Unauthorized"})
        }

        let database = new Database("content", "creators")
        let result = await database.collection.updateOne({_id: user._id}, {$set: {username: req.body.username, iconURL: req.body.icon, bannerURL: req.body.banner}})
        if(result.acknowledged && result.modifiedCount === 1) {
            return res.code(200).send({})
        } else {
            return res.code(400).send({error: "Failed to update user"})
        }

    }).catch((err) => {
        return res.code(401).send({error: "Unauthorized"})
    })
})

const UpdateProfileLayoutBody = Type.Object({
    layout: ProfileLayout
})

type UpdateProfileLayoutBody = Static<typeof UpdateProfileLayoutBody>

Router.app.post<{ 
    Body: UpdateProfileLayoutBody, 
    Headers: AuthorizationHeader, 
    Reply: GenericResponseType<TVoid> 
}>("/user/updateProfileLayout", async (req, res) => {
    if(req.headers.authorization.startsWith("Bearer ")) {
        return res.code(401).send({error: "Unauthorized"})
    }
    processAuthorizationHeader(req.headers.authorization).then(async (user) => {
        if(!user) {
            return res.code(401).send({error: "Unauthorized"})
        }

        let database = new Database("content", "creators")
        let result = await database.collection.updateOne({_id: user._id}, {$set: {profileLayout: req.body.layout}})
        if(result.acknowledged && result.modifiedCount === 1) {
            return res.code(200).send()
        } else {
            return res.code(400).send({error: "Failed to update user"})
        }
    }).catch((err) => {
        return res.code(401).send({error: "Unauthorized"})
    })
})

const UpdateSettingsSchema = Type.Object({
    notifications: Type.Object({
        comment: NotificationOption,
        like: NotificationOption,
        reply: NotificationOption,
        follow: NotificationOption,
        rating: NotificationOption,
        translation: NotificationOption
    })
})

type UpdateSettingsBody = Static<typeof UpdateSettingsSchema>

Router.app.post<{ 
    Body: UpdateSettingsBody, 
    Headers: AuthorizationHeader, 
    Reply: GenericResponseType<TVoid> 
}>("/user/updateSettings", async (req, res) => {
    if(req.headers.authorization.startsWith("Bearer ")) {
        return res.code(401).send({error: "Unauthorized"})
    }
    _dangerouslyGetUnsanitizedUserFromJWT(req.headers.authorization).then(async (user) => {
        if(!user) {
            return res.code(401).send({error: "Unauthorized"})
        }

        let database = new Database("content", "creators")
        let result = await database.collection.updateOne({_id: user._id}, {$set: {settings: req.body}})
        if(result.acknowledged && result.modifiedCount === 1) {
            return res.code(200).send()
        } else {
            return res.code(400).send({error: "Failed to update user"})
        }
    }).catch((err) => {
        return res.code(401).send({error: "Unauthorized"})
    })
})

const UpdateHandleBody = Type.Object({
    handle: Type.String()
})

type UpdateHandleBody = Static<typeof UpdateHandleBody>

Router.app.post<{ 
    Body: UpdateHandleBody, 
    Headers: AuthorizationHeader, 
    Reply: GenericResponseType<TVoid> 
}>("/user/updateHandle", async (req, res) => {
    if(req.headers.authorization.startsWith("Bearer ")) {
        return res.code(401).send({error: "Unauthorized"})
    }
    processAuthorizationHeader(req.headers.authorization).then(async (user) => {
        if(!user) {
            return res.code(401).send({error: "Unauthorized"})
        }

        const handle = req.body.handle

        let database = new Database("content", "creators")
        let existingUser = await database.collection.findOne({handle: handle})
        if(existingUser) {
            return res.code(400).send({error: "Another account is already using that handle"})
        }

        let result = await database.collection.updateOne({_id: user._id}, {$set: {handle: handle}})
        if(result.acknowledged && result.modifiedCount === 1) {
            // Update handle in all content
            for(let content of ["Maps", "datapacks", "resourcepacks", "marketplace", "comments", "leaderboards", "notifications"] as CollectionName[]) {
                database = new Database("content", content)
                await database.collection.updateMany({"creators.handle": user.handle}, {$set: {"creators.$.handle": handle}})
                await database.collection.updateMany({"owner": user.handle}, {$set: {"owner": handle}})
            }
            
            return res.code(200).send()
        } else {
            return res.code(400).send({error: "Failed to update user"})
        }

    }).catch((err) => {
        return res.code(401).send({error: "Unauthorized"})
    })
})

const UpdateEmailBody = Type.Object({
    email: Type.String()
})

type UpdateEmailBody = Static<typeof UpdateEmailBody>

Router.app.post<{ 
    Body: UpdateEmailBody, 
    Headers: AuthorizationHeader, 
    Reply: GenericResponseType<TVoid> 
}>("/user/updateEmail", async (req, res) => {
    if(req.headers.authorization.startsWith("Bearer ")) {
        return res.code(401).send({error: "Unauthorized"})
    }
    processAuthorizationHeader(req.headers.authorization).then(async (user) => {
        if(!user) {
            return res.code(401).send({error: "Unauthorized"})
        }

        user.email = req.body.email.toLowerCase()

        let database = new Database("content", "creators")
        let existingUser = await database.collection.findOne({email: req.body.email.toLowerCase(), _id: {$ne: user._id}})
        if(existingUser) {
            return res.code(400).send({error: "Another account is already using that email"})
        }

        let result = await database.collection.updateOne({_id: user._id}, {$set: user})
        if(result.acknowledged && result.modifiedCount === 1) {
            return res.code(200).send()
        } else {
            return res.code(400).send({error: "Failed to update user"})
        }
    }).catch((err) => {
        return res.code(401).send({error: "Unauthorized"})
    })
})

const AddProviderBody = Type.Object({
    provider: Type.Enum(Providers),
    code: Type.String()
})

type AddProviderBody = Static<typeof AddProviderBody>

Router.app.post<{ 
    Body: AddProviderBody, 
    Headers: AuthorizationHeader, 
    Reply: GenericResponseType<TVoid> 
}>("/user/providers", async (req, res) => {
    if(req.headers.authorization.startsWith("Bearer ")) {
        return res.code(401).send({error: "Unauthorized"})
    }
    _dangerouslyGetUnsanitizedUserFromJWT(req.headers.authorization).then(async (user) => {
        if(!user) {
            return res.code(401).send({error: "Unauthorized"})
        }

        if(user.providers?.find((provider) => provider.provider === req.body.provider)) {
            return res.code(400).send({error: "Provider already added"})
        }

        if(req.body.provider === Providers.Discord) {
            let token = await getDiscordAccessToken(req.body.code)
            let discordUser = await getDiscordUser(token)
            user.providers?.push({
                provider: req.body.provider,
                token: token,
                refreshToken: "",
                id: discordUser.id
            })
        } else if(req.body.provider === Providers.Github) {
            let token = await getGithubAccessToken(req.body.code)
            let githubUser = await getGithubUser(token)
            user.providers?.push({
                provider: req.body.provider,
                token: token,
                refreshToken: "",
                id: githubUser.id
            })
        } else if(req.body.provider === Providers.Google) {
            let googleUser = await getGoogleUser(req.body.code)
            user.providers?.push({
                provider: req.body.provider,
                token: req.body.code,
                refreshToken: "",
                id: googleUser.id
            })
        } else if(req.body.provider === Providers.Microsoft) {
            let token = await getMicrosoftAccessToken(req.body.code)
            let microsoftUser = await getMicrosoftUser(token)
            user.providers?.push({
                provider: req.body.provider,
                token: token,
                refreshToken: "",
                id: microsoftUser.id
            })
        }

        let database = new Database("content", "creators")
        let result = await database.collection.updateOne({_id: user._id}, {$set: user})
        if(result.acknowledged && result.modifiedCount === 1) {
            return res.code(200).send()
        } else {
            return res.code(400).send({error: "Failed to update user"})
        }

    }).catch((err) => {
        return res.code(401).send({error: "Unauthorized"})
    })
})

const RemoveProviderBody = Type.Object({
    provider: Type.Enum(Providers)
})

type RemoveProviderBody = Static<typeof RemoveProviderBody>

Router.app.delete<{ 
    Body: RemoveProviderBody, 
    Headers: AuthorizationHeader, 
    Reply: GenericResponseType<TVoid> 
}>("/user/providers", async (req, res) => {
    if(req.headers.authorization.startsWith("Bearer ")) {
        return res.code(401).send({error: "Unauthorized"})
    }
    _dangerouslyGetUnsanitizedUserFromJWT(req.headers.authorization).then(async (user) => {
        if(!user) {
            return res.code(401).send({error: "Unauthorized"})
        }

        user.providers = user.providers?.filter((provider) => provider.provider !== req.body.provider)

        let database = new Database("content", "creators")
        let result = await database.collection.updateOne({_id: user._id}, {$set: user})
        if(result.acknowledged && result.modifiedCount === 1) {
            return res.code(200).send()
        } else {
            return res.code(400).send({error: "Failed to update user"})
        }
    }).catch((err) => {
        return res.code(401).send({error: "Unauthorized"})
    })
})

const UpdatePasswordBody = Type.Object({
    password: Type.String()
})

type UpdatePasswordBody = Static<typeof UpdatePasswordBody>

Router.app.post<{
    Body: UpdatePasswordBody,
    Headers: AuthorizationHeader,
    Reply: GenericResponseType<TVoid>
}>("/user/updatePassword", async (req, res) => {
    if(req.headers.authorization.startsWith("Bearer ")) {
        return res.code(401).send({error: "Unauthorized"})
    }
    _dangerouslyGetUnsanitizedUserFromJWT(req.headers.authorization).then(async (user) => {
        if(!user) {
            return res.code(401).send({error: "Unauthorized"})
        }

        bcryptHash(req.body.password).then((hash) => {
            user.password = hash
            user.last_important_update = new Date()
        }).then(async () => {
            let database = new Database("content", "creators")
            let result = await database.collection.updateOne({_id: user._id}, {$set: user})
            if(result.acknowledged && result.modifiedCount === 1) {
                return res.code(200).send()
            } else {
                return res.code(400).send({error: "Failed to update user"})
            }
        })
    }).catch((err) => {
        return res.code(401).send({error: "Unauthorized"})
    })
})

const ForgotPasswordBody = Type.Object({
    email: Type.String()
})

type ForgotPasswordBody = Static<typeof ForgotPasswordBody>

Router.app.post<{
    Body: ForgotPasswordBody,
    Reply: GenericResponseType<TVoid>
}>("/user/forgotPassword", async (req, res) => {
    let database = new Database("content", "creators")
    let user = await database.collection.findOne({email: req.body.email.toLowerCase()})
    if(user) {
        forgotPasswordEmail(req.body.email.toLowerCase(), createJWT({_id: user._id}, "30min"))
        return res.code(200).send()
    } else {
        return res.code(400).send({error: "User not found"})
    }
})