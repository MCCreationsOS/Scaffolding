import { app } from "../index.js";
import bcrypt from "bcrypt";
import { AuthError, Providers, User, UserTypes } from "./types.js";
import { Database, DatabaseQueryBuilder } from "../db/connect.js";
import { Request } from "express";
import { ObjectId } from "mongodb";
import jwt from 'jsonwebtoken'
import { upload } from "../s3/upload.js";
import { forgotPasswordEmail } from "../email/email.js";
import { sendLog } from "../logging/logging.js";
import { get } from "http";
const saltRounds = 10;
export let JWTKey = process.env.JWTKey + ""

export function initializeAuthRoutes() {
    // Get a user from a JWT token sent in the authorization header
    app.get('/auth/user', async (req, res) => {
        if(req.headers.authorization) {
            res.send(await getUserFromJWT(req.headers.authorization));
        } else {
            console.log("authorization not sent")
            res.send({error: "You are not allowed to access this resource"})
        }

    })

    app.get('/auth/user/creators', async (req, res) => {
        if(req.headers.authorization) {
            let user = await getUserFromJWT(req.headers.authorization)
            if('user' in user && user.user) {
                let creators = [user.user]
                let database = new Database('content', 'creators')
                let cursor = await database.collection.find<User>({'owners': user.user.handle})
                creators = [...creators, ...await cursor.toArray()]
                res.send({creators: creators})
            } else {
                res.send({error: "You are not allowed to access this resource"})
            }
        } else {
            console.log("authorization not sent")
            res.send({error: "You are not allowed to access this resource"})
        }
    })

    // Delete a user
    app.delete('/auth/user', async (req, res) => {
        if(req.headers.authorization) {
            try {
                let user = await getUserFromJWT(req.headers.authorization)
                if(user && user.user) {
                    let database = new Database("content", "creators")
                    let result = await database.collection.deleteOne({_id: user.user._id})
                    if(result.acknowledged && result.deletedCount === 1) {
                        res.sendStatus(200)
                    } else {
                        res.send({error: "User not found"})
                    }
                } else {
                    console.log("Token not in JWT")
                    res.send({error: "Session expired, please sign in and try again"})
                }
            } catch(err) {
                sendLog("delete user", err)
                console.log("JWT not verified " + err)
                res.send({error: "Session expired, please sign in and try again"})
            }
            
        } else {
            console.log("authorization not sent")
            res.send({error: "You are not allowed to access this resource"})
        }
    })

    // Update a user's profile (username, icon, banner, about)
    app.post('/auth/user/updateProfile', async (req, res) => {
        if(req.headers.authorization) {
            try {
                let user = await getUserFromJWT(req.headers.authorization)
                if(user && user.user) {
                    let database = new Database("content", "creators")
                    
                    if(req.body.banner && req.body.banner.length > 1) {
                        await database.collection.updateOne({_id: user.user._id}, {$set: {bannerURL: req.body.banner}})
                    }

                    if(req.body.icon && req.body.icon.length > 1) {
                        await database.collection.updateOne({_id: user.user._id}, {$set: {iconURL: req.body.icon}})
                    }

                    if(req.body.username && req.body.username.length > 1) {
                        await database.collection.updateOne({_id: user.user._id}, {$set: {username: req.body.username}})
                    }

                    if(req.body.about && req.body.about.length > 1) {
                        await database.collection.updateOne({_id: user.user._id}, {$set: {about: req.body.about}})
                    }

                    res.sendStatus(200)

                } else {
                    console.log("Token not in JWT")
                    res.send({error: "Session expired, please sign in and try again"})
                }
            } catch(err) {
                sendLog("updateProfile", err)
                console.log("JWT not verified")
                res.send({error: "Session expired, please sign in and try again"})
            }
            
        } else {
            console.log("authorization not sent")
            res.send({error: "You are not allowed to access this resource"})
        }
    })

    // Update a user's handle
    app.post('/auth/user/updateHandle', async (req, res) => {
        if(req.headers.authorization) {
            try {
                let user = await getUserFromJWT(req.headers.authorization)
                if(user && user.user) {
                    // Change handle
                    let database = new Database("content", "creators")
                    let existingUser = await database.collection.findOne({handle: req.body.handle})
                    if(existingUser) {
                        res.send({error: "Another account is already using that handle"})
                        return;
                    }
                    await database.collection.updateOne({_id: user.user._id}, {$set: {handle: req.body.handle}})

                    // Update handle in all content
                    database = new Database("content", "Maps")
                    await database.collection.updateMany({"creators.handle": user.user.handle}, {$set: {"creators.$.handle": req.body.handle}})
                    await database.collection.updateMany({"owner": user.user.handle}, {$set: {"owner": req.body.handle}})

                    database = new Database("content", "datapacks")
                    await database.collection.updateMany({"creators.handle": user.user.handle}, {$set: {"creators.$.handle": req.body.handle}})
                    await database.collection.updateMany({"owner": user.user.handle}, {$set: {"owner": req.body.handle}})

                    database = new Database("content", "resourcepacks")
                    await database.collection.updateMany({"creators.handle": user.user.handle}, {$set: {"creators.$.handle": req.body.handle}})
                    await database.collection.updateMany({"owner": user.user.handle}, {$set: {"owner": req.body.handle}})

                    database = new Database("content", "comments")
                    await database.collection.updateMany({"handle": user.user.handle}, {$set: {"handle": req.body.handle}})

                    
                    res.sendStatus(200)
                } else {
                    console.log("Token not in JWT")
                    res.send({error: "Session expired, please sign in and try again"})
                }
            } catch(err) {
                sendLog("updateHandle", err)
                console.log("JWT not verified")
                res.send({error: "Session expired, please sign in and try again"})
            }
            
        } else {
            console.log("authorization not sent")
            res.send({error: "You are not allowed to access this resource"})
        }
    })

    // Update a user's email
    app.post('/auth/user/updateEmail', async (req, res) => {
        if(req.headers.authorization) {
            try {
                let user = await getUserFromJWT(req.headers.authorization)
                if(user && user.user) {
                    let database = new Database("content", "creators")
                    let existingUser = await database.collection.findOne({email: req.body.email})
                    if(existingUser) {
                        res.send({error: "Another account is already using that email"})
                        return;
                    }
                    await database.collection.updateOne({_id: user.user._id}, {$set: {email: req.body.email, last_important_update: Date.now()}})
                    res.sendStatus(200)
                } else {
                    console.log("Token not in JWT")
                    res.send({error: "Session expired, please sign in and try again"})
                }
            } catch(err) {
                sendLog("updateEmail", err)
                console.log("JWT not verified")
                res.send({error: "Session expired, please sign in and try again"})
            }
            
        } else {
            console.log("authorization not sent")
            res.send({error: "You are not allowed to access this resource"})
        }
    })

    // Update a user's password
    app.post('/auth/user/updatePassword', async (req, res) => {
        if(req.headers.authorization) {
            try {
                let user = await getUserFromJWT(req.headers.authorization)
                if(user && user.user) {
                    let database = new Database("content", "creators")
                    bcrypt.hash(req.body.password, saltRounds, async (err, hash) => {
                        if(err) {
                            res.send({error: "There was an error resetting your password"})
                            return;
                        }
                        await database.collection.updateOne({_id: user.user._id}, {$set: {password: hash, last_important_update: Date.now()}})
                        res.sendStatus(200)
                    })
                } else {
                    console.log("Token not in JWT")
                    res.send({error: "Session expired, please sign in and try again"})
                }
            } catch(err) {
                sendLog("updatePassword", err)
                console.log("JWT not verified")
                res.send({error: "Session expired, please sign in and try again"})
            }
            
        } else {
            console.log("authorization not sent")
            res.send({error: "You are not allowed to access this resource"})
        }
    })

    app.post('/auth/resetPassword', async (req, res) => {
        if(req.headers.authorization) {
            try {
                let user = await getUserFromJWT(req.headers.authorization)
                if(user && user.user) {
                    let database = new Database("content", "creators")
                    if(user && req.body.password) { 
                        bcrypt.hash(req.body.password, saltRounds, async (err, hash) => {
                            if(err) {
                                console.error(err)
                                res.send({error: "There was an error resetting your password"})
                                return;
                            }

                            await database.collection.updateOne( {_id: user.user._id}, {"$set": { password: hash, last_important_update: Date.now() } } )
                            res.sendStatus(200)
                        })
                    } else {
                        res.send({error: "User not found; Please request a new reset email"})
                    }
                } else {
                    console.log("Token not in JWT")
                    res.send({error: "Token expired; Please request a new reset email"})
                }
            } catch(e) {
                sendLog("resetPassword", e)
                console.log("JWT not verified")
                res.send({error: "Token expired; Please request a new reset email"})
            }
        } else {
            console.log("authorization not sent")
            res.send({error: "You are not allowed to access this resource"})
        }
    })

    app.post('/auth/forgotPassword', async (req, res) => {
        if(req.body.email) {
            let database = new Database("content", "creators")
            let user = await database.collection.findOne({email: req.body.email})
            if(user) {
                forgotPasswordEmail(req.body.email, jwt.sign({_id: user._id}, JWTKey, { expiresIn: "30min"}))
                res.sendStatus(200)
            } else {
                res.send({error: "User not found"})
            }
        } else {
            res.send({error: "Email address not provided"})
        }
    })

    app.post('/auth/signUpWithEmail', async (req, res) => {
        let user = req.body as User
        let database = new Database("content", "creators")

        if(!user.password) {
            res.send({error: "No password provided"});
            return;
        }

        let existingUser = await database.collection.findOne({email: user.email.trim().toLowerCase()})
        if(existingUser) {
            res.send({error: "Email already in use"})
            return;
        }

        bcrypt.hash(user.password, saltRounds, async (err, hash) => {
            if(err) {
                res.send({error: "Bcrypt Error"})
                return;
            }

            user.password = undefined;
            user.password = hash;
            user.type = UserTypes.Account,
            user.iconURL = "https://next.mccreations.net/mcc_no_scaffold.png"
            user.handle = user.username.toLowerCase().replace(" ", "-");

            existingUser = await database.collection.findOne({handle: user.username})
            if(existingUser) {
                user.handle = user.username.toLowerCase().replace(" ", "-") + Math.floor(Math.random() * 10000)
            }

            user.email = user.email.toLowerCase()

            await database.collection.insertOne(user)
            res.sendStatus(200)
        })
    })

    app.post('/auth/signInWithEmail', async (req, res) => {
        let user = req.body as User
        let database = new Database("content", "creators")

        if(!user.password) {
            res.send({error: "No password provided"});
            return;
        }

        let existingUser = await database.collection.findOne({email: user.email})
        if(!existingUser) {
            res.send({error: "Incorrect email address or password"})
            return;
        }

        if(!existingUser.password) {
            res.send({error: "Incorrect email address or password"})
            return;
        }
        bcrypt.compare(user.password, existingUser.password, (err, same) => {
            if(same) {
                console.log("user login successful")
                res.send({token: jwt.sign({_id: existingUser!._id, createdDate: Date.now()}, JWTKey, {expiresIn: '31d'}), creator: {username: existingUser!.username, handle: existingUser!.handle}})
            } else {
                res.send({error: "Incorrect email address or password"})
            }
        })
    })

    app.post('/auth/signInWithDiscord', async (req, res) => {
        if(req.query.code && req.query.code !== "undefined") {
            let result = await signInWithDiscord(req.query.code as string)
            if(instanceOfUser(result)) {
                result = result as User;
                res.send({token: jwt.sign({_id: result._id, createdDate: Date.now()}, JWTKey, {expiresIn: '31d'}), creator: {username: result.username}})
            } else {
                console.log(result)
                res.send(result)
                // res.sendStatus(500)
            }
        }
    })

    app.post('/auth/signInWithGithub', async (req, res) => {
        if(req.query.code && req.query.code !== "undefined") {
            let result = await signInWithGithub(req.query.code as string)
            if(instanceOfUser(result)) {
                result = result as User
                res.send({token: jwt.sign({_id: result._id, createdDate: Date.now()}, JWTKey, {expiresIn: '31d'}), creator: {username: result.username, handle: result.handle}})
            } else {
                console.log(result)
                res.send(result)
                // res.sendStatus(500)
            }
        }
    })

    app.post('/auth/signInWithGoogle', async (req, res) => {
        if(req.query.access_token && req.query.access_token !== "undefined") {
            let result = await signInWithGoogle(req.query.access_token as string);
            if(instanceOfUser(result)) {
                result = result as User
                res.send({token: jwt.sign({_id: result._id, createdDate: Date.now()}, JWTKey, {expiresIn: '31d'}), creator: {username: result.username, handle: result.handle}})
            } else {
                console.log(result)
                res.send(result)
            }
        }
    })

    app.post('/auth/signInWithMicrosoft', async (req, res) => {
        if(req.query.code && req.query.code !== "undefined") {
            let result = await signInWithMicrosoft(req.query.code as string);
            if(instanceOfUser(result)) {
                result = result as User
                res.send({token: jwt.sign({_id: result._id, createdDate: Date.now()}, JWTKey, {expiresIn: '31d'}), creator: {username: result.username, handle: result.handle}})
            } else {
                console.log(result)
                res.send(result)
            }
        }
    })
}

async function signInWithDiscord(code: string): Promise<User | AuthError> {
    let res = await fetch('https://discord.com/api/oauth2/token', {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            'client_id': process.env.DISCORD_CLIENT_ID + "",
            'client_secret': process.env.DISCORD_SECRET + "",
            code,
            'grant_type': 'authorization_code',
            'redirect_uri': 'https://mccreations.net/auth/oauth_handler?provider=discord',
            'scope': 'identify+email'
        }).toString(),
        method: 'POST'
    })
    let data = await res.json();
    let access_token = data.access_token;
    let token_type = data.token_type
    let refresh_token = data.refresh_token

    if(!access_token) return {error: "Access token was not received "}

    res = await fetch('https://discord.com/api/users/@me', {
        headers: {
            authorization: `${token_type} ${access_token}`
        }
    })
    let discordUser = await res.json();
    if(!discordUser) return {error: "Discord user could not be fetched"}

    const database = new Database("content", "creators")

    let existingUser = await database.collection.findOne<User>({ "providers.id": discordUser.id})
    if(existingUser && existingUser.providers && existingUser.providers.length > 0) {
        let foundProvider = false;
        existingUser.providers?.forEach(provider => {
            if(provider.provider === Providers.Discord) {
                foundProvider = true
                provider.token = access_token
            }
        })
        if(foundProvider) return existingUser
        else return createUserFromProviderData(discordUser.email, discordUser.global_name, Providers.Discord, access_token, refresh_token, discordUser.id, `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}`, `https://cdn.discordapp.com/banners/${discordUser.id}/${discordUser.banner}`)
    } else {
        return createUserFromProviderData(discordUser.email, discordUser.global_name, Providers.Discord, access_token, refresh_token, discordUser.id, `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}`, `https://cdn.discordapp.com/banners/${discordUser.id}/${discordUser.banner}`)
    }
}

async function signInWithGithub(code: string): Promise<User | AuthError>  {
    let githubParams = new URLSearchParams({
        client_id: process.env.GITHUB_CLIENT_ID + "",
        client_secret: process.env.GITHUB_SECRET + "",
        code: code,
        scope: "user:email,read:user"
    })
    let res = await fetch(`https://github.com/login/oauth/access_token?${githubParams.toString()}`, {
        headers: {
            'Accept': 'application/json'
        },
        method: 'POST'
    })

    let data = await res.json();
    console.log(data)
    // console.log(data.access_token)
    let access_token = data.access_token;
    let token_type = data.token_type

    if(!access_token) return {error: "Access token was not received "}

    res = await fetch('https://api.github.com/user', {
        headers: {
            authorization: `${token_type} ${access_token}`
        }
    })
    let githubUser = await res.json();
    if(!githubUser) return {error: "Github user could not be fetched"}

    const database = new Database("content", "creators")

    let existingUser = await database.collection.findOne<User>({ "providers.id": githubUser.id})
    if(existingUser && existingUser.providers && existingUser.providers.length > 0) {
        let foundProvider = false;
        existingUser.providers?.forEach(provider => {
            if(provider.provider === Providers.Github) {
                foundProvider = true
                provider.token = access_token
            }
        })
        if(foundProvider) return existingUser
        else return createUserFromProviderData(githubUser.email, githubUser.login, Providers.Github, access_token, "", githubUser.id, githubUser.avatar_url, "")
    } else {
        return createUserFromProviderData(githubUser.email, githubUser.login, Providers.Github, access_token, "", githubUser.id, githubUser.avatar_url, "")
    }
}

async function signInWithGoogle(access_token: string): Promise<User | AuthError> {
    let res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: {
            authorization: "Bearer " + access_token
        }
    })
    let data = await res.json();

    if(data.error) return {error: "Invalid access token, try again."}
    
    const database = new Database("content", "creators")

    let existingUser = await database.collection.findOne<User>({ "providers.id": data.id})
    if(existingUser && existingUser.providers && existingUser.providers.length > 0) {
        let foundProvider = false;
        existingUser.providers?.forEach(provider => {
            if(provider.provider === Providers.Google) {
                foundProvider = true
                provider.token = access_token
            }
        })
        if(foundProvider) return existingUser
        else return createUserFromProviderData(data.email, data.name, Providers.Google, access_token, "", data.id, data.picture, "")
    } else {
        return createUserFromProviderData(data.email, data.name, Providers.Google, access_token, "", data.id, data.picture, "")
    }
}

async function signInWithMicrosoft(code: string): Promise<User | AuthError> {
    let res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            'client_id': process.env.MICROSOFT_CLIENT_ID + "",
            'client_secret': process.env.MICROSOFT_SECRET + "",
            'code': code,
            'grant_type': 'authorization_code',
            'redirect_uri': 'https://mccreations.net/auth/oauth_handler',
            'scope': 'openid email profile'
        }).toString(),
        method: 'POST'
    })
    let data = await res.json();
    console.log(data)
    let access_token = data.access_token;
    let token_type = data.token_type

    res = await fetch('https://graph.microsoft.com/oidc/userinfo', {
        headers: {
            authorization: `${token_type} ${access_token}`
        }
    })
    let microsoftUser = await res.json();
    console.log(microsoftUser)
    if(!microsoftUser) return {error: "Microsoft user could not be fetched"}

    const database = new Database("content", "creators")

    let existingUser = await database.collection.findOne<User>({ "providers.id": microsoftUser.sub})
    if(existingUser && existingUser.providers && existingUser.providers.length > 0) {
        let foundProvider = false;
        existingUser.providers?.forEach(provider => {
            if(provider.provider === Providers.Microsoft) {
                foundProvider = true
                provider.token = access_token
            }
        })
        if(foundProvider) return existingUser
        else return createUserFromProviderData(microsoftUser.email, microsoftUser.name ?? microsoftUser.givenname + microsoftUser.familyname, Providers.Microsoft, access_token, "", microsoftUser.sub, "", "")
    } else {
        return createUserFromProviderData(microsoftUser.email, microsoftUser.name ?? microsoftUser.givenname + microsoftUser.familyname, Providers.Microsoft, access_token, "", microsoftUser.sub, "", "")
    }
}

async function createUserFromProviderData(email: string, username: string, provider: Providers, token: string, refreshToken: string, id: string, iconURL: string, bannerURL: string): Promise<User | AuthError> {
    const database = new Database("content", "creators")

    let existingUser = await database.collection.findOne<User>({email: email})
    if(existingUser && email) {
        return {error: "User already exists but is using a different provider"}
    } else {
        let user: User = {
            username: username + "",
            email: email,
            type: UserTypes.Account,
            iconURL: iconURL,
            bannerURL: bannerURL,
            providers: [
                {
                    provider: provider,
                    token: token,
                    refreshToken: refreshToken,
                    id: id
                }
            ]
        }

        existingUser = await database.collection.findOne<User>({handle: user.username})
        if(existingUser) {
            user.handle = username.toLowerCase().replace(" ", "-") + Math.floor(Math.random() * 10000)
        }
        else {
            user.handle = username.toLowerCase().replace(" ", "-");
        }

        await database.collection.insertOne(user)

        return user
    }

}

export async function getUserFromJWT(jwtString: string) {
    try {
        let token = jwt.verify(jwtString, JWTKey) as any
        if(token && token._id) {
            let _id = new ObjectId(token._id)
            let database = new Database("content", "creators")
            let query = new DatabaseQueryBuilder()
            query.buildQuery("_id", _id);
            query.setProjection({
                password: 0,
                providers: 0
            })
            let cursor = await database.executeQuery(query);
            let user = await cursor.next() as User;
            if(user && ((user.last_important_update && token.createdDate && user.last_important_update < token.createdDate) || !user.last_important_update)) {
                return {user: user} 
            } else {
                console.log("User not found")
                return {error: "Session expired, please sign in and try again"}
            }
        } else {
            console.log("Token not in JWT")
            return {error: "Session expired, please sign in and try again"} 
        }
    } catch(err) {
        sendLog("getUserFromJWT", err + "\n JWT: " + jwtString)
        console.log("JWT not verified")
        return {error: "Session expired, please sign in and try again"} 
    }
}

export function getIdFromJWT(jwtString: string) {
    console.log(jwtString)
    try {
        let token = jwt.verify(jwtString, JWTKey) as any
        if(token && token._id) {
            return new ObjectId(token._id)
        }
    } catch(e) {
        sendLog("getIdFromJWT", e + "\n JWT: " + jwtString)
        console.log('JWT Error: ' + e);
        return {error: "Session expired, please sign in and try again"}
    }
}

function instanceOfUser(object: any) {
    return 'username' in object
}

export async function refreshJWTHash() {
    JWTKey = (await crypto.getRandomValues(new Uint8Array(256))).join("")
}