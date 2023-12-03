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
import { Providers, UserTypes } from "./types.js";
import { Database } from "../db/connect.js";
import { ObjectId } from "mongodb";
import jwt from 'jsonwebtoken';
const saltRounds = 10;
const JWTKey = "literally1984";
export function initializeAuthRoutes() {
    app.get('/auth/user', (req, res) => __awaiter(this, void 0, void 0, function* () {
        if (req.headers.authorization) {
            try {
                let token = jwt.verify(req.headers.authorization, JWTKey);
                if (token && token._id) {
                    let database = new Database("content", "creators");
                    let user = yield database.collection.findOne({ _id: token._id });
                    if (user) {
                        console.log(user);
                        res.send({ user: user });
                    }
                    else {
                        console.log("User not found");
                        res.sendStatus(404);
                    }
                }
                else {
                    console.log("Token not in JWT");
                    res.sendStatus(403);
                }
            }
            catch (err) {
                console.log("JWT not verified");
                res.sendStatus(403);
            }
        }
        else {
            console.log("authorization not sent");
            res.sendStatus(403);
        }
    }));
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
    app.post('/auth/signInWithDiscord', (req, res) => __awaiter(this, void 0, void 0, function* () {
        let result = yield signInWithDiscord(req.query.code);
        if (result instanceof ObjectId) {
            res.send({ token: jwt.sign({ _id: result }, JWTKey, { expiresIn: '31d' }) });
        }
        else {
            console.log(result);
            res.send(result);
            res.sendStatus(500);
        }
    }));
}
function signInWithDiscord(code) {
    var _a;
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
                'redirect_uri': 'http://localhost:3000/auth/oauth_handler?provider=discord',
                'scope': 'identify+email'
            }).toString(),
            method: 'POST'
        });
        let data = yield res.json();
        let access_token = data.access_token;
        let token_type = data.token_type;
        let refresh_token = data.refresh_token;
        if (!access_token)
            return { message: "Access token was not received" };
        res = yield fetch('https://discord.com/api/users/@me', {
            headers: {
                authorization: `${token_type} ${access_token}`
            }
        });
        let discordUser = yield res.json();
        if (!discordUser)
            return { message: "Discord user could not be fetched" };
        const database = new Database("content", "creators");
        let existingUser = yield database.collection.findOne({ "providers.id": discordUser.id });
        if (existingUser) {
            (_a = existingUser.providers) === null || _a === void 0 ? void 0 : _a.forEach(provider => {
                if (provider.provider === Providers.Discord) {
                    provider.token = access_token,
                        provider.refreshToken = refresh_token;
                }
            });
            return existingUser._id;
        }
        else {
            existingUser = yield database.collection.findOne({ email: discordUser.email });
            if (existingUser) {
                return { message: "User already exists but is using a different provider" };
            }
            else {
                let user = {
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
                };
                return (yield database.collection.insertOne(user)).insertedId;
            }
        }
    });
}
