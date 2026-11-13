
import { Static, TVoid, Type } from "@sinclair/typebox";
import { _dangerouslyGetUnsanitizedUserFromJWT, bcryptCompare, bcryptHash, createPasswordResetJWT, getUserFromPasswordResetJWT, getDiscordAccessToken, getDiscordUser, getGithubAccessToken, getGithubUser, getGoogleUser, getMicrosoftAccessToken, getMicrosoftUser, processAuthorizationHeader } from "../../auth/user";
import { CollectionName, Database } from "../../database";
import { NotificationOption, ProfileLayout, SocialLink, User } from "../../schemas/user";
import { Router } from "../router";
import { AuthorizationHeader } from "../../schemas/auth";
import { ErrorSchema, GenericResponseType, WithCount } from "../../schemas/generic";
import { Providers } from "../../database/models/users";
import { forgotPasswordEmail } from "../../email";
import { Creation, TCreation } from "../../schemas/creation";
import { Search } from "../../search";
import { Comment, TComment } from "../../schemas/comment";
import dompurify from "isomorphic-dompurify";
import { revalidateFrontend } from "../../utils/creations";

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

const WithCountFeed = Type.Object({
    totalCount: Type.Number(),
    documents: Type.Array(Type.Union([TCreation, TComment]))
})

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

    const search = new Search<Creation>(["maps", "resourcepacks", "datapacks"])
    search.filter({filter: {key: "status", operation: ">=", value: 1, combiner: "AND"}, combiner: "AND"})
    search.filter({filter: user.following?.map(creator => {
        return {key: "creators.handle", operation: "=", value: creator, combiner: "OR"}
    }) ?? [], combiner: "AND"})
    search.paginate(parseInt(req.query.limit ?? "20"), parseInt(req.query.page ?? "0") + 1)
    let documents = await search.execute()

    const feed = [...documents?.documents ?? []]
    feed.sort((a, b) => {
        let aDate = (a as any)['createdDate'] ?? (a as any)['date']
        let bDate = (b as any)['createdDate'] ?? (b as any)['date']
        return bDate - aDate
    })

    // if(feed.length === 0) {
    //     return res.code(400).send({error: "Failed to fetch feed"})
    // }
    // The total across all pages (not just this page), so the frontend can paginate
    return res.code(200).send({totalCount: documents?.totalCount ?? feed.length, documents: feed})
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
    banner: Type.String(),
    about: Type.String(),
    customCSS: Type.String()
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

        // Only update the fields that were actually sent, so partial updates (e.g. just the username)
        // don't wipe the rest of the profile
        const update: Record<string, string> = {}
        if(typeof req.body.username === "string") update.username = req.body.username
        if(typeof req.body.icon === "string") update.iconURL = req.body.icon
        if(typeof req.body.banner === "string") update.bannerURL = req.body.banner
        if(typeof req.body.about === "string") update.about = dompurify.sanitize(req.body.about)
        if(typeof req.body.customCSS === "string") update.customCSS = dompurify.sanitize(req.body.customCSS)

        if(Object.keys(update).length === 0) {
            return res.code(400).send({error: "No fields to update"})
        }

        let database = new Database("content", "creators")
        let result = await database.collection.updateOne({_id: user._id}, {$set: update})
        if(result.acknowledged) {
            // Creator pages are cached; refresh them so the change shows up straight away
            await revalidateFrontend("creator")
            return res.code(200).send({})
        } else {
            return res.code(400).send({error: "Failed to update user"})
        }

    }).catch((err) => {
        return res.code(401).send({error: "Unauthorized"})
    })
})

const UpdateSocialLinksBody = Type.Object({
    links: Type.Array(SocialLink)
})

type UpdateSocialLinksBody = Static<typeof UpdateSocialLinksBody>

Router.app.post<{
    Body: UpdateSocialLinksBody,
    Headers: AuthorizationHeader,
    Reply: GenericResponseType<TVoid>
}>("/user/updateSocialLinks", async (req, res) => {
    if(req.headers.authorization.startsWith("Bearer ")) {
        return res.code(401).send({error: "Unauthorized"})
    }
    processAuthorizationHeader(req.headers.authorization).then(async (user) => {
        if(!user) {
            return res.code(401).send({error: "Unauthorized"})
        }

        let database = new Database("content", "creators")
        let result = await database.collection.updateOne({_id: user._id}, {$set: {socialLinks: req.body.links}})
        if(result.acknowledged) {
            // Creator pages are cached; refresh them so the change shows up straight away
            await revalidateFrontend("creator")
            return res.code(200).send()
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
        if(result.acknowledged) {
            // Creator pages are cached; refresh them so the change shows up straight away
            await revalidateFrontend("creator")
            return res.code(200).send()
        } else {
            return res.code(400).send({error: "Failed to update user"})
        }
    }).catch((err) => {
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
        if(result.acknowledged) {
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
        if(result.acknowledged) {
            // Update handle in all content
            for(let content of ["Maps", "datapacks", "resourcepacks", "marketplace", "comments", "leaderboards", "notifications"] as CollectionName[]) {
                database = new Database("content", content)
                await database.collection.updateMany({"creators.handle": user.handle}, {$set: {"creators.$.handle": handle}})
                await database.collection.updateMany({"owner": user.handle}, {$set: {"owner": handle}})
            }
            
            // Creator pages are cached; refresh them so the change shows up straight away
            await revalidateFrontend("creator")
            return res.code(200).send()
        } else {
            return res.code(400).send({error: "Failed to update user"})
        }

    }).catch((err) => {
        return res.code(401).send({error: "Unauthorized"})
    })
})

/**
 * Accounts with a password must confirm it before changing their email or password, so a leaked
 * session token alone can't take over the account. Accounts that only use OAuth have no password.
 */
async function confirmsCurrentPassword(user: { password?: string | null }, currentPassword?: string) {
    if (!user.password) return true
    if (!currentPassword) return false
    return bcryptCompare(currentPassword, user.password).catch(() => false)
}

const UpdateEmailBody = Type.Object({
    email: Type.String(),
    currentPassword: Type.Optional(Type.String())
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
    _dangerouslyGetUnsanitizedUserFromJWT(req.headers.authorization).then(async (user) => {
        // processAuthorizationHeader also checks the token hasn't been invalidated by a password change
        if(!user || !await processAuthorizationHeader(req.headers.authorization)) {
            return res.code(401).send({error: "Unauthorized"})
        }

        if(!await confirmsCurrentPassword(user, req.body.currentPassword)) {
            return res.code(403).send({error: "Your current password is incorrect"})
        }

        const email = String(req.body.email ?? "").trim().toLowerCase()
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.code(400).send({error: "Invalid email"})
        }

        let database = new Database("content", "creators")
        let existingUser = await database.collection.findOne({email: email, _id: {$ne: user._id}})
        if(existingUser) {
            return res.code(400).send({error: "Another account is already using that email"})
        }

        let result = await database.collection.updateOne({_id: user._id}, {$set: {email: email}})
        if(result.acknowledged) {
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
        // Accounts created with email and password start without a providers list
        user.providers = user.providers ?? []

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
    password: Type.String(),
    currentPassword: Type.Optional(Type.String())
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
    try {
        // Either a password reset link (no current password needed) or a signed-in session
        let user = await getUserFromPasswordResetJWT(req.headers.authorization)
        if(!user) {
            const sessionUser = await _dangerouslyGetUnsanitizedUserFromJWT(req.headers.authorization)
            if(!sessionUser || !await processAuthorizationHeader(req.headers.authorization)) {
                return res.code(401).send({error: "Unauthorized"})
            }
            if(!await confirmsCurrentPassword(sessionUser, req.body.currentPassword)) {
                return res.code(403).send({error: "Your current password is incorrect"})
            }
            user = sessionUser
        }

        if(!req.body.password || req.body.password.length < 9) {
            return res.code(400).send({error: "Password is too short"})
        }

        const hash = await bcryptHash(req.body.password)
        let database = new Database("content", "creators")
        let result = await database.collection.updateOne({_id: user._id}, {$set: {password: hash, last_important_update: new Date()}})
        if(result.acknowledged && result.matchedCount === 1) {
            return res.code(200).send()
        } else {
            return res.code(400).send({error: "Failed to update user"})
        }
    } catch(err) {
        return res.code(401).send({error: "Unauthorized"})
    }
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
    let user = await database.collection.findOne({email: String(req.body.email ?? "").toLowerCase()})
    if(user) {
        forgotPasswordEmail(req.body.email.toLowerCase(), createPasswordResetJWT(user._id))
    }
    // Same response either way so this can't be used to find out which emails have accounts
    return res.code(200).send()
})