import { app } from "../index.js";
import bcrypt from "bcrypt";
import { User } from "./types.js";
import { Database } from "../db/connect.js";
import { Request } from "express";
const saltRounds = 10;

export function initializeAuthRoutes() {
    app.get('/auth/user/:email', (req, res) => {

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

    app.get('/auth/oauth_handler', (req, res) => {
        let referer = req.headers.referer;

        if(referer === "https://discord.com") {
            if(req.query.code) {
                signInWithDiscord(req.query.code as string)
            }

        }
    })
}

async function signInWithDiscord(code: string) {
    let res = await fetch('https://discord.com/api/oauth2/token', {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            'client_id': "882869275063386153",
            'client_secret': "iRLt58vpsYscUVpePGAurWaWgnXNucfB",
            'grant-type': 'authorization_code',
            'code': code,
            'redirect_uri': 'https://api.mccreations.net/auth/oauth_handler'
        }).toString(),
        method: 'POST'
    })
    let data = await res.json();
    let access_token = data.access_token;
    let token_type = data.token_type

    res = await fetch('https://discord.com/api/users/@me', {
        headers: {
            authorization: `${token_type} ${access_token}`
        }
    })
    let discordUser = await res.json();

    console.log(discordUser)
}