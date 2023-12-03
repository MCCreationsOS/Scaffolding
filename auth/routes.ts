import { app } from "../index.js";
import bcrypt from "bcrypt";
import { AuthError, Providers, User, UserTypes } from "./types.js";
import { Database } from "../db/connect.js";
import { Request } from "express";
import { ObjectId } from "mongodb";
import jwt from 'jsonwebtoken'
const saltRounds = 10;
const JWTKey = "literally1984"

export function initializeAuthRoutes() {
    app.get('/auth/user', (req, res) => {
        if(req.headers.authorization) {
            try {
                let token = jwt.verify(req.headers.authorization, JWTKey)
                console.log(token);
                res.sendStatus(200);
            } catch(err) {

            }
            
        } else {
            res.sendStatus(403)
        }

    })

    app.post('/auth/signUpWithEmail', (req, res) => {
        let user = req.body.user as User
        let database = new Database("content", "creators")

        if(!user.password) {
            res.send({message: "No password provided"}); 
            res.sendStatus(403); 
            return;
        }

        bcrypt.hash(user.password, saltRounds, (err, hash) => {
            if(err) {
                res.send({message: "Hashing Error!"})
                res.sendStatus(500)
                return;
            }

            user.password = undefined;
            user.password = hash;

            database.collection.insertOne(user)
        })
    })

    app.post('/auth/signInWithDiscord', async (req, res) => {
        let result = await signInWithDiscord(req.query.code as string)
        if(result instanceof ObjectId) {
            res.send({token: jwt.sign({_id: result}, JWTKey)})
        } else {
            res.sendStatus(500)
        }
    })
}

async function signInWithDiscord(code: string): Promise<ObjectId | AuthError> {
    let res = await fetch('https://discord.com/api/oauth2/token', {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            'client_id': "882869275063386153",
            'client_secret': "iRLt58vpsYscUVpePGAurWaWgnXNucfB",
            code,
            'grant_type': 'authorization_code',
            'redirect_uri': 'http://localhost:3000/auth/oauth_handler',
            'scope': 'identify+email'
        }).toString(),
        method: 'POST'
    })
    let data = await res.json();
    let access_token = data.access_token;
    let token_type = data.token_type
    let refresh_token = data.refresh_token

    res = await fetch('https://discord.com/api/users/@me', {
        headers: {
            authorization: `${token_type} ${access_token}`
        }
    })
    let discordUser = await res.json();

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