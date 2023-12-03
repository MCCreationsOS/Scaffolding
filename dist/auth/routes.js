var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { app } from "../index.js";
import bcrypt from "bcrypt";
import { Database } from "../db/connect.js";
const saltRounds = 10;
export function initializeAuthRoutes() {
    app.get('/auth/user/:email', (req, res) => {
    });
    app.post('/auth/signUpWithEmail', (req, res) => {
        let user = req.body.user;
        let database = new Database("content", "creators");
        if (!user.password) {
            res.send({ message: "No password provided" });
            res.sendStatus(403);
            return;
        }
        bcrypt.hash(user.password, saltRounds, (err, hash) => {
            if (err) {
                res.send({ message: "Hashing Error!" });
                res.sendStatus(500);
                return;
            }
            user.password = undefined;
            user.password = hash;
            database.collection.insertOne(user);
        });
    });
    app.get('/auth/oauth_handler', (req, res) => {
        let referer = req.headers.referer;
        console.log(req.headers);
        // if(referer === "https://discord.com") {
        if (req.query.code) {
            signInWithDiscord(req.query.code);
        }
        // }
        res.send(200);
    });
}
function signInWithDiscord(code) {
    return __awaiter(this, void 0, void 0, function* () {
        let res = yield fetch('https://discord.com/api/oauth2/token', {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                'client_id': "882869275063386153",
                'client_secret': "iRLt58vpsYscUVpePGAurWaWgnXNucfB",
                code,
                'grant_type': 'authorization_code',
                'redirect_uri': 'https://api.mccreations.net/auth/oauth_handler',
                'scope': 'identify+email'
            }).toString(),
            method: 'POST'
        });
        let data = yield res.json();
        console.log(data);
        let access_token = data.access_token;
        let token_type = data.token_type;
        res = yield fetch('https://discord.com/api/users/@me', {
            headers: {
                authorization: `${token_type} ${access_token}`
            }
        });
        let discordUser = yield res.json();
        console.log(discordUser);
    });
}
