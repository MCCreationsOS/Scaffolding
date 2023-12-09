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
import { Database, DatabaseQueryBuilder } from "../db/connect.js";
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
                    let _id = new ObjectId(token._id);
                    let database = new Database("content", "creators");
                    let query = new DatabaseQueryBuilder();
                    query.buildQuery("_id", _id);
                    query.setProjection({
                        password: 0,
                        providers: 0
                    });
                    let cursor = yield database.executeQuery(query);
                    let user = yield cursor.next();
                    if (user) {
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
    app.post('/auth/signUpWithEmail', (req, res) => __awaiter(this, void 0, void 0, function* () {
        let user = req.body.user;
        let database = new Database("content", "creators");
        if (!user.password) {
            res.send({ message: "No password provided" });
            return;
        }
        let existingUser = yield database.collection.findOne({ email: user.email });
        if (existingUser) {
            res.send({ message: "User already exists" });
            return;
        }
        bcrypt.hash(user.password, saltRounds, (err, hash) => {
            if (err) {
                res.send({ message: "Hashing Error!" });
                return;
            }
            user.password = undefined;
            user.password = hash;
            database.collection.insertOne(user);
        });
    }));
    app.post('/auth/signInWithEmail', (req, res) => __awaiter(this, void 0, void 0, function* () {
        let user = req.body.user;
        let database = new Database("content", "creators");
        if (!user.password) {
            res.send({ message: "No password provided" });
            return;
        }
        let existingUser = yield database.collection.findOne({ email: user.email });
        if (!existingUser) {
            res.send({ message: "User does not exist" });
            return;
        }
        if (!existingUser.password) {
            res.send({ message: "User does not have a password set" });
            return;
        }
        bcrypt.compare(user.password, existingUser.password, (err, same) => {
            if (same) {
                res.send({ token: jwt.sign({ _id: existingUser._id }, JWTKey, { expiresIn: '31d' }) });
            }
        });
    }));
    app.post('/auth/signInWithDiscord', (req, res) => __awaiter(this, void 0, void 0, function* () {
        let result = yield signInWithDiscord(req.query.code);
        if (result instanceof ObjectId) {
            res.send({ token: jwt.sign({ _id: result }, JWTKey, { expiresIn: '31d' }) });
        }
        else {
            console.log(result);
            res.send(result);
            // res.sendStatus(500)
        }
    }));
    app.post('/auth/signInWithGithub', (req, res) => __awaiter(this, void 0, void 0, function* () {
        let result = yield signInWithGithub(req.query.code);
        if (result instanceof ObjectId) {
            res.send({ token: jwt.sign({ _id: result }, JWTKey, { expiresIn: '31d' }) });
        }
        else {
            console.log(result);
            res.send(result);
            // res.sendStatus(500)
        }
    }));
    app.post('/auth/signInWithGoogle', (req, res) => __awaiter(this, void 0, void 0, function* () {
        let result = yield signInWithGoogle(req.query.access_token);
        if (result instanceof ObjectId) {
            res.send({ token: jwt.sign({ _id: result }, JWTKey, { expiresIn: '31d' }) });
        }
        else {
            console.log(result);
            res.send(result);
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
            return { message: "Access token was not received " + data.toString() };
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
function signInWithGithub(code) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        let githubParams = new URLSearchParams({
            client_id: "d8fb2f8d7b4f8f88c320",
            client_secret: "5b24a7011c4db6ba6b5feec392e5f21103ea8225",
            code: code,
            scope: "user:email,read:user"
        });
        let res = yield fetch(`https://github.com/login/oauth/access_token?${githubParams.toString()}`, {
            headers: {
                'Accept': 'application/json'
            },
            method: 'POST'
        });
        let data = yield res.json();
        console.log(data);
        // console.log(data.access_token)
        let access_token = data.access_token;
        let token_type = data.token_type;
        if (!access_token)
            return { message: "Access token was not received " };
        res = yield fetch('https://api.github.com/user', {
            headers: {
                authorization: `${token_type} ${access_token}`
            }
        });
        let githubUser = yield res.json();
        if (!githubUser)
            return { message: "Github user could not be fetched" };
        const database = new Database("content", "creators");
        let existingUser = yield database.collection.findOne({ "providers.id": githubUser.id });
        if (existingUser) {
            (_a = existingUser.providers) === null || _a === void 0 ? void 0 : _a.forEach(provider => {
                if (provider.provider === Providers.Github) {
                    provider.token = access_token;
                }
            });
            return existingUser._id;
        }
        else {
            existingUser = yield database.collection.findOne({ email: githubUser.email });
            if (existingUser && githubUser.email) {
                return { message: "User already exists but is using a different provider" };
            }
            else {
                let user = {
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
                };
                return (yield database.collection.insertOne(user)).insertedId;
            }
        }
    });
}
function signInWithGoogle(access_token) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        let res = yield fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: {
                authorization: "Bearer " + access_token
            }
        });
        let data = yield res.json();
        const database = new Database("content", "creators");
        let existingUser = yield database.collection.findOne({ "providers.id": data.id });
        if (existingUser) {
            (_a = existingUser.providers) === null || _a === void 0 ? void 0 : _a.forEach(provider => {
                if (provider.provider === Providers.Github) {
                    provider.token = access_token;
                }
            });
            return existingUser._id;
        }
        else {
            existingUser = yield database.collection.findOne({ email: data.email });
            if (existingUser && data.email) {
                return { message: "User already exists but is using a different provider" };
            }
            else {
                let user = {
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
                };
                return (yield database.collection.insertOne(user)).insertedId;
            }
        }
    });
}
