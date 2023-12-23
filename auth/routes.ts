import { app } from "../index.js";
import bcrypt from "bcrypt";
import { AuthError, Providers, User, UserTypes } from "./types.js";
import { Database, DatabaseQueryBuilder } from "../db/connect.js";
import { Request } from "express";
import { ObjectId } from "mongodb";
import jwt from 'jsonwebtoken'
import { upload } from "../s3/upload.js";
import { forgotPasswordEmail } from "../email/email.js";
const saltRounds = 10;
const JWTKey = "literally1984"

export function initializeAuthRoutes() {
    app.get('/auth/user', async (req, res) => {
        if(req.headers.authorization) {
            try {
                let token = jwt.verify(req.headers.authorization, JWTKey) as any
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
                    let user = await cursor.next();
                    if(user) {
                        res.send({user: user})
                    } else {
                        console.log("User not found")
                        res.sendStatus(404)
                    }
                } else {
                    console.log("Token not in JWT")
                    res.sendStatus(403)
                }
            } catch(err) {
                console.log("JWT not verified")
                res.sendStatus(403)
            }
            
        } else {
            console.log("authorization not sent")
            res.sendStatus(403)
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
                    res.sendStatus(403)
                }
            } catch(err) {
                console.log("JWT not verified")
                res.sendStatus(403)
            }
            
        } else {
            console.log("authorization not sent")
            res.sendStatus(403)
        }
    })

    app.post('/auth/user/updateHandle', async (req, res) => {
        if(req.headers.authorization) {
            try {
                let token = jwt.verify(req.headers.authorization, JWTKey) as any
                if(token && token._id) {
                    let _id = new ObjectId(token._id)
                    let database = new Database("content", "creators")
                    database.collection.updateOne({_id: _id}, {$set: {handle: req.body.handle}})
                } else {
                    console.log("Token not in JWT")
                    res.sendStatus(403)
                }
            } catch(err) {
                console.log("JWT not verified")
                res.sendStatus(403)
            }
            
        } else {
            console.log("authorization not sent")
            res.sendStatus(403)
        }
    })

    app.post('/auth/user/updateEmail', async (req, res) => {
        if(req.headers.authorization) {
            try {
                let token = jwt.verify(req.headers.authorization, JWTKey) as any
                if(token && token._id) {
                    let _id = new ObjectId(token._id)
                    let database = new Database("content", "creators")
                    database.collection.updateOne({_id: _id}, {$set: {email: req.body.email}})
                } else {
                    console.log("Token not in JWT")
                    res.sendStatus(403)
                }
            } catch(err) {
                console.log("JWT not verified")
                res.sendStatus(403)
            }
            
        } else {
            console.log("authorization not sent")
            res.sendStatus(403)
        }
    })

    app.post('/auth/user/updatePassword', async (req, res) => {
        if(req.headers.authorization) {
            try {
                let token = jwt.verify(req.headers.authorization, JWTKey) as any
                if(token && token._id) {
                    let _id = new ObjectId(token._id)
                    let database = new Database("content", "creators")
                    database.collection.updateOne({_id: _id}, {$set: {password: req.body.password}})
                } else {
                    console.log("Token not in JWT")
                    res.sendStatus(403)
                }
            } catch(err) {
                console.log("JWT not verified")
                res.sendStatus(403)
            }
            
        } else {
            console.log("authorization not sent")
            res.sendStatus(403)
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
                                res.send({message: "Hashing Error!"})
                                return;
                            }

                            database.collection.updateOne( {_id: user?._id}, {"$set": { password: hash } } )
                        })
                    } else {
                        res.sendStatus(404);
                    }
                } else {
                    console.log("Token not in JWT")
                    res.sendStatus(403)
                }
            } catch(e) {
                console.log("JWT not verified")
                res.sendStatus(403)
            }
        } else {
            console.log("authorization not sent")
            res.sendStatus(403)
        }
    })

    app.post('/auth/forgotPassword', async (req, res) => {
        if(req.body.email) {
            forgotPasswordEmail(req.body.email, jwt.sign({email: req.body.email}, JWTKey, { expiresIn: "30min"}))
            res.sendStatus(200)
        } else {
            res.sendStatus(300)
        }
    })

    app.post('/auth/signUpWithEmail', async (req, res) => {
        let user = req.body as User
        let database = new Database("content", "creators")

        if(!user.password) {
            res.send({message: "No password provided"});
            return;
        }

        let existingUser = await database.collection.findOne({email: user.email})
        if(existingUser) {
            res.send({message: "User already exists"})
            return;
        }

        bcrypt.hash(user.password, saltRounds, async (err, hash) => {
            if(err) {
                res.send({message: "Hashing Error!"})
                return;
            }

            user.password = undefined;
            user.password = hash;
            user.type = UserTypes.Account,

            existingUser = await database.collection.findOne({handle: user.username})
            if(existingUser) {
                user.handle = user.username.toLowerCase().replace(" ", "-") + Math.floor(Math.random() * 10000)
            }
            else {
                user.handle = user.username.toLowerCase().replace(" ", "-");
            }

            database.collection.insertOne(user)
        })
    })

    app.post('/auth/signInWithEmail', async (req, res) => {
        let user = req.body as User
        let database = new Database("content", "creators")

        if(!user.password) {
            res.send({message: "No password provided"});
            return;
        }

        let existingUser = await database.collection.findOne({email: user.email})
        if(!existingUser) {
            res.send({message: "User does not exist"})
            return;
        }

        if(!existingUser.password) {
            res.send({message: "User does not have a password set"})
            return;
        }
        bcrypt.compare(user.password, existingUser.password, (err, same) => {
            if(same) {
                console.log("user login successful")
                res.send({token: jwt.sign({_id: existingUser!._id}, JWTKey, {expiresIn: '31d'})})
            }
        })
    })

    app.post('/auth/signInWithDiscord', async (req, res) => {
        let result = await signInWithDiscord(req.query.code as string)
        if(result instanceof ObjectId) {
            res.send({token: jwt.sign({_id: result}, JWTKey, {expiresIn: '31d'})})
        } else {
            console.log(result)
            res.send(result)
            // res.sendStatus(500)
        }
    })

    app.post('/auth/signInWithGithub', async (req, res) => {
        let result = await signInWithGithub(req.query.code as string)
        if(result instanceof ObjectId) {
            res.send({token: jwt.sign({_id: result}, JWTKey, {expiresIn: '31d'})})
        } else {
            console.log(result)
            res.send(result)
            // res.sendStatus(500)
        }
    })

    app.post('/auth/signInWithGoogle', async (req, res) => {
        let result = await signInWithGoogle(req.query.access_token as string);
        if(result instanceof ObjectId) {
            res.send({token: jwt.sign({_id: result}, JWTKey, {expiresIn: '31d'})})
        } else {
            console.log(result)
            res.send(result)
        }
    })

    app.post('/auth/signInWithMicrosoft', async (req, res) => {
        let result = await signInWithMicrosoft(req.query.code as string);
        if(result instanceof ObjectId) {
            res.send({token: jwt.sign({_id: result}, JWTKey, {expiresIn: '31d'})})
        } else {
            console.log(result)
            res.send(result)
        }
    })
}

async function signInWithDiscord(code: string): Promise<ObjectId | AuthError> {
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

    if(!access_token) return {message: "Access token was not received " + data.toString()}

    res = await fetch('https://discord.com/api/users/@me', {
        headers: {
            authorization: `${token_type} ${access_token}`
        }
    })
    let discordUser = await res.json();
    if(!discordUser) return {message: "Discord user could not be fetched"}

    const database = new Database("content", "creators")

    let existingUser = await database.collection.findOne<User>({ "providers.id": discordUser.id})
    if(existingUser) {
        existingUser.providers?.forEach(provider => {
            if(provider.provider === Providers.Discord) {
                provider.token = access_token,
                provider.refreshToken = refresh_token
            }
        })
        return existingUser._id!
    } else {
        existingUser = await database.collection.findOne<User>({email: discordUser.email})
        if(existingUser) {
            return {message: "User already exists but is using a different provider"}
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

            return (await database.collection.insertOne(user)).insertedId
        }
    }
}

async function signInWithGithub(code: string)  {
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

    if(!access_token) return {message: "Access token was not received "}

    res = await fetch('https://api.github.com/user', {
        headers: {
            authorization: `${token_type} ${access_token}`
        }
    })
    let githubUser = await res.json();
    if(!githubUser) return {message: "Github user could not be fetched"}

    const database = new Database("content", "creators")

    let existingUser = await database.collection.findOne<User>({ "providers.id": githubUser.id})
    if(existingUser) {
        existingUser.providers?.forEach(provider => {
            if(provider.provider === Providers.Github) {
                provider.token = access_token
            }
        })
        return existingUser._id!
    } else {
        existingUser = await database.collection.findOne<User>({email: githubUser.email})
        if(existingUser && githubUser.email) {
            return {message: "User already exists but is using a different provider"}
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

            return (await database.collection.insertOne(user)).insertedId
        }
    }
}

async function signInWithGoogle(access_token: string) {
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
        return existingUser._id!
    } else {
        existingUser = await database.collection.findOne<User>({email: data.email})
        if(existingUser && data.email) {
            return {message: "User already exists but is using a different provider"}
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

            return (await database.collection.insertOne(user)).insertedId
        }
    }
}

async function signInWithMicrosoft(code: string) {
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
    if(!microsoftUser) return {message: "Github user could not be fetched"}

    const database = new Database("content", "creators")

    let existingUser = await database.collection.findOne<User>({ "providers.id": microsoftUser.sub})
    if(existingUser) {
        existingUser.providers?.forEach(provider => {
            if(provider.provider === Providers.Github) {
                provider.token = access_token
            }
        })
        return existingUser._id!
    } else {
        existingUser = await database.collection.findOne<User>({email: microsoftUser.email})
        if(existingUser && microsoftUser.email) {
            return {message: "User already exists but is using a different provider"}
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

            return (await database.collection.insertOne(user)).insertedId
        }
    }
}