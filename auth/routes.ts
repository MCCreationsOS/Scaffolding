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
const saltRounds = 10;
export const JWTKey = "literally1984"

export function initializeAuthRoutes() {
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

    app.delete('/auth/user', async (req, res) => {
        if(req.headers.authorization) {
            try {
                let token = jwt.verify(req.headers.authorization, JWTKey) as any
                if(token && token._id) {
                    let _id = new ObjectId(token._id)
                    let database = new Database("content", "creators")
                    database.collection.deleteOne({_id: _id})
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

    app.post('/auth/user/updateProfile', async (req, res) => {
        if(req.headers.authorization) {
            try {
                let token = jwt.verify(req.headers.authorization, JWTKey) as any
                if(token && token._id) {
                    let _id = new ObjectId(token._id)
                    let database = new Database("content", "creators")

                    console.log(req.body)
                    
                    if(req.body.banner && req.body.banner.length > 1) {
                        database.collection.updateOne({_id: _id}, {$set: {bannerURL: req.body.banner}})
                    }

                    if(req.body.icon && req.body.icon.length > 1) {
                        database.collection.updateOne({_id: _id}, {$set: {iconURL: req.body.icon}})
                    }

                    if(req.body.username && req.body.username.length > 1) {
                        database.collection.updateOne({_id: _id}, {$set: {username: req.body.username}})
                    }

                    if(req.body.about && req.body.about.length > 1) {
                        database.collection.updateOne({_id: _id}, {$set: {about: req.body.about}})
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

    app.post('/auth/user/updateHandle', async (req, res) => {
        if(req.headers.authorization) {
            try {
                let token = jwt.verify(req.headers.authorization, JWTKey) as any
                if(token && token._id) {
                    let _id = new ObjectId(token._id)
                    let database = new Database("content", "creators")
                    let existingUser = await database.collection.findOne({email: req.body.handle})
                    if(existingUser) {
                        res.send({error: "Another account is already using that handle"})
                        return;
                    }
                    database.collection.updateOne({_id: _id}, {$set: {handle: req.body.handle}})
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

    app.post('/auth/user/updateEmail', async (req, res) => {
        if(req.headers.authorization) {
            try {
                let token = jwt.verify(req.headers.authorization, JWTKey) as any
                if(token && token._id) {
                    let _id = new ObjectId(token._id)
                    let database = new Database("content", "creators")
                    let existingUser = await database.collection.findOne({email: req.body.email})
                    if(existingUser) {
                        res.send({error: "Another account is already using that email"})
                        return;
                    }
                    database.collection.updateOne({_id: _id}, {$set: {email: req.body.email}})
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

    app.post('/auth/user/updatePassword', async (req, res) => {
        if(req.headers.authorization) {
            try {
                let token = jwt.verify(req.headers.authorization, JWTKey) as any
                if(token && token._id) {
                    let _id = new ObjectId(token._id)
                    let database = new Database("content", "creators")
                    bcrypt.hash(req.body.password, saltRounds, async (err, hash) => {
                        if(err) {
                            res.send({error: "There was an error resetting your password"})
                            return;
                        }
                        database.collection.updateOne({_id: _id}, {$set: {password: hash}})
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
                let token = jwt.verify(req.headers.authorization, JWTKey) as any
                if(token && token.email) {
                    let database = new Database("content", "creators")
                    let user = await database.collection.findOne({email: token.email})
                    if(user && req.body.password) { 
                        bcrypt.hash(user.password, saltRounds, async (err, hash) => {
                            if(err) {
                                console.error(err)
                                res.send({error: "There was an error resetting your password"})
                                return;
                            }

                            database.collection.updateOne( {_id: user?._id}, {"$set": { password: hash } } )
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
            try {
                forgotPasswordEmail(req.body.email, jwt.sign({email: req.body.email}, JWTKey, { expiresIn: "30min"}))
                res.sendStatus(200)
            } catch(e) {
                sendLog("forgotPassword", e)
                res.send({error: "There was an error sending the reset email. Try again"})
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

        let existingUser = await database.collection.findOne({email: user.email})
        if(existingUser) {
            res.send({error: "Email already in use"})
            return;
        }

        bcrypt.hash(user.password, saltRounds, async (err, hash) => {
            if(err) {
                res.send({error: "There was an error creating your account, please try again"})
                return;
            }

            user.password = undefined;
            user.password = hash;
            user.type = UserTypes.Account,
            user.iconURL = "https://next.mccreations.net/mcc_no_scaffold.png"

            existingUser = await database.collection.findOne({handle: user.username})
            if(existingUser) {
                user.handle = user.username.toLowerCase().replace(" ", "-") + Math.floor(Math.random() * 10000)
            }
            else {
                user.handle = user.username.toLowerCase().replace(" ", "-");
            }

            user.email = user.email.toLowerCase()

            database.collection.insertOne(user)
            res.send(200)
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
                res.send({token: jwt.sign({_id: existingUser!._id}, JWTKey, {expiresIn: '31d'}), creator: {username: existingUser!.username, handle: existingUser!.handle}})
            } else {
                res.send({error: "Incorrect email address or password"})
            }
        })
    })

    app.post('/auth/signInWithDiscord', async (req, res) => {
        let result = await signInWithDiscord(req.query.code as string)
        if(instanceOfUser(result)) {
            result = result as User;
            res.send({token: jwt.sign({_id: result._id}, JWTKey, {expiresIn: '31d'}), creator: {username: result.username}})
        } else {
            console.log(result)
            res.send(result)
            // res.sendStatus(500)
        }
    })

    app.post('/auth/signInWithGithub', async (req, res) => {
        let result = await signInWithGithub(req.query.code as string)
        if(instanceOfUser(result)) {
            result = result as User
            res.send({token: jwt.sign({_id: result._id}, JWTKey, {expiresIn: '31d'}), creator: {username: result.username, handle: result.handle}})
        } else {
            console.log(result)
            res.send(result)
            // res.sendStatus(500)
        }
    })

    app.post('/auth/signInWithGoogle', async (req, res) => {
        let result = await signInWithGoogle(req.query.access_token as string);
        if(instanceOfUser(result)) {
            result = result as User
            res.send({token: jwt.sign({_id: result._id}, JWTKey, {expiresIn: '31d'}), creator: {username: result.username, handle: result.handle}})
        } else {
            console.log(result)
            res.send(result)
        }
    })

    app.post('/auth/signInWithMicrosoft', async (req, res) => {
        let result = await signInWithMicrosoft(req.query.code as string);
        if(instanceOfUser(result)) {
            result = result as User
            res.send({token: jwt.sign({_id: result._id}, JWTKey, {expiresIn: '31d'}), creator: {username: result.username, handle: result.handle}})
        } else {
            console.log(result)
            res.send(result)
        }
    })
}

async function signInWithDiscord(code: string): Promise<User | AuthError> {
    let res = await fetch('https://discord.com/api/oauth2/token', {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            'client_id': "***REMOVED***",
            'client_secret': "***REMOVED***",
            code,
            'grant_type': 'authorization_code',
            'redirect_uri': 'https://next.mccreations.net/auth/oauth_handler?provider=discord',
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
    if(existingUser) {
        existingUser.providers?.forEach(provider => {
            if(provider.provider === Providers.Discord) {
                provider.token = access_token,
                provider.refreshToken = refresh_token
            }
        })
        return existingUser
    } else {
        existingUser = await database.collection.findOne<User>({email: discordUser.email})
        if(existingUser) {
            return {error: "User already exists but is using a different provider"}
        } else {
            let user: User = {
                username: discordUser.global_name,
                email: discordUser.email,
                type: UserTypes.Account,
                iconURL: `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}`,
                bannerURL: `https://cdn.discordapp.com/banners/${discordUser.id}/${discordUser.banner}`,
                providers: [
                    {
                        provider: Providers.Discord,
                        token: access_token,
                        refreshToken: refresh_token,
                        id: discordUser.id
                    }
                ]
            }

            existingUser = await database.collection.findOne<User>({handle: user.username})
            if(existingUser) {
                user.handle = user.username.toLowerCase().replace(" ", "-") + Math.floor(Math.random() * 10000)
            }
            else {
                user.handle = user.username.toLowerCase().replace(" ", "-");
            }
            await database.collection.insertOne(user)
            return user
        }
    }
}

async function signInWithGithub(code: string): Promise<User | AuthError>  {
    let githubParams = new URLSearchParams({
        client_id: "***REMOVED***",
        client_secret: "***REMOVED***",
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
    if(existingUser) {
        existingUser.providers?.forEach(provider => {
            if(provider.provider === Providers.Github) {
                provider.token = access_token
            }
        })
        return existingUser
    } else {
        existingUser = await database.collection.findOne<User>({email: githubUser.email})
        if(existingUser && githubUser.email) {
            return {error: "User already exists but is using a different provider"}
        } else {
            let user: User = {
                username: githubUser.login,
                email: githubUser.email,
                type: UserTypes.Account,
                iconURL: githubUser.avatar_url,
                providers: [
                    {
                        provider: Providers.Github,
                        token: access_token,
                        refreshToken: "",
                        id: githubUser.id
                    }
                ]
            }

            existingUser = await database.collection.findOne<User>({handle: user.username})
            if(existingUser) {
                user.handle = user.username.toLowerCase().replace(" ", "-") + Math.floor(Math.random() * 10000)
            }
            else {
                user.handle = user.username.toLowerCase().replace(" ", "-");
            }
            await database.collection.insertOne(user)
            return user
        }
    }
}

async function signInWithGoogle(access_token: string): Promise<User | AuthError> {
    let res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: {
            authorization: "Bearer " + access_token
        }
    })
    let data = await res.json();
    
    const database = new Database("content", "creators")

    let existingUser = await database.collection.findOne<User>({ "providers.id": data.id})
    if(existingUser) {
        existingUser.providers?.forEach(provider => {
            if(provider.provider === Providers.Github) {
                provider.token = access_token
            }
        })
        return existingUser
    } else {
        existingUser = await database.collection.findOne<User>({email: data.email})
        if(existingUser && data.email) {
            return {error: "User already exists but is using a different provider"}
        } else {
            let user: User = {
                username: data.name,
                email: data.email,
                type: UserTypes.Account,
                iconURL: data.picture,
                providers: [
                    {
                        provider: Providers.Google,
                        token: access_token,
                        refreshToken: "",
                        id: data.id
                    }
                ]
            }

            existingUser = await database.collection.findOne<User>({handle: user.username})
            if(existingUser) {
                user.handle = user.username.toLowerCase().replace(" ", "-") + Math.floor(Math.random() * 10000)
            }
            else {
                user.handle = user.username.toLowerCase().replace(" ", "-");
            }

            await database.collection.insertOne(user)

            return user
        }
    }
}

async function signInWithMicrosoft(code: string): Promise<User | AuthError> {
    let res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            'client_id': "***REMOVED***",
            'client_secret': "Rao8Q~FVIUeFC7PbsB0MqEhbReoKbUtcrCJnqdos",
            'code': code,
            'grant_type': 'authorization_code',
            'redirect_uri': 'https://next.mccreations.net/auth/oauth_handler',
            'scope': 'openid email profile'
        }).toString(),
        method: 'POST'
    })
    let data = await res.json();
    let access_token = data.access_token;
    let token_type = data.token_type

    res = await fetch('https://graph.microsoft.com/oidc/userinfo', {
        headers: {
            authorization: `${token_type} ${access_token}`
        }
    })
    let microsoftUser = await res.json();
    if(!microsoftUser) return {error: "Github user could not be fetched"}

    const database = new Database("content", "creators")

    let existingUser = await database.collection.findOne<User>({ "providers.id": microsoftUser.sub})
    if(existingUser) {
        existingUser.providers?.forEach(provider => {
            if(provider.provider === Providers.Github) {
                provider.token = access_token
            }
        })
        return existingUser
    } else {
        existingUser = await database.collection.findOne<User>({email: microsoftUser.email})
        if(existingUser && microsoftUser.email) {
            return {error: "User already exists but is using a different provider"}
        } else {
            let user: User = {
                username: microsoftUser.name,
                email: microsoftUser.email,
                type: UserTypes.Account,
                providers: [
                    {
                        provider: Providers.Microsoft,
                        token: access_token,
                        refreshToken: "",
                        id: microsoftUser.sub
                    }
                ]
            }

            existingUser = await database.collection.findOne<User>({handle: user.username})
            if(existingUser) {
                user.handle = (user.username.toLowerCase() + Math.floor(Math.random() * 10000)).replace(" ", "-")
            }
            else {
                user.handle = user.username.toLowerCase().replace(" ", "-");
            }

            await database.collection.insertOne(user)

            return user
        }
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
            if(user) {
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
        sendLog("getUserFromJWT", err)
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
        sendLog("getIdFromJWT", e)
        console.log('JWT Error: ' + e);
        return {error: "Session expired, please sign in and try again"}
    }
}

function instanceOfUser(object: any) {
    return 'username' in object
}