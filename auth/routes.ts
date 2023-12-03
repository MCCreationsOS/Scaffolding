import { app } from "../index.js";
import bcrypt from "bcrypt";
import { AuthError, Providers, User, UserTypes } from "./types.js";
import { Database, DatabaseQueryBuilder } from "../db/connect.js";
import { Request } from "express";
import { ObjectId } from "mongodb";
import jwt from 'jsonwebtoken'
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

    app.post('/auth/signUpWithEmail', async (req, res) => {
        let user = req.body.user as User
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

        bcrypt.hash(user.password, saltRounds, (err, hash) => {
            if(err) {
                res.send({message: "Hashing Error!"})
                return;
            }

            user.password = undefined;
            user.password = hash;

            database.collection.insertOne(user)
        })
    })

    app.post('/auth/signInWithEmail', async (req, res) => {
        let user = req.body.user as User
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
            res.sendStatus(500)
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
            'redirect_uri': 'http://localhost:3000/auth/oauth_handler?provider=discord',
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

            return (await database.collection.insertOne(user)).insertedId
        }
    }
}

async function signInWithGithub(code: string)  {
    let res = await fetch(`https://github.com/login/oauth/access_token?client_id=***REMOVED***&client_secret=***REMOVED***&code=${code}&scope=user:email,read:user`, {
        headers: {
            'Accept': 'application/json'
        },
        method: 'POST'
    })

    let data = await res.json();
    console.log(data)
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

    console.log(githubUser)   
}