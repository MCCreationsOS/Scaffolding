import $cpgow$express from "express";
import $cpgow$bodyparser from "body-parser";
import $cpgow$helmet from "helmet";
import $cpgow$cors from "cors";
import $cpgow$morgan from "morgan";
import {createServer as $cpgow$createServer} from "http";
import {MongoClient as $cpgow$MongoClient, ObjectId as $cpgow$ObjectId, ServerApiVersion as $cpgow$ServerApiVersion} from "mongodb";
import {en as $cpgow$en} from "naughty-words";
import {MeiliSearch as $cpgow$MeiliSearch} from "meilisearch";
import $cpgow$bcrypt from "bcrypt";
import $cpgow$jsonwebtoken from "jsonwebtoken";
import $cpgow$sendgridmail from "@sendgrid/mail";
import $cpgow$axios from "axios";
import {JSDOM as $cpgow$JSDOM} from "jsdom";
import $cpgow$puppeteer from "puppeteer";
import {Upload as $cpgow$Upload} from "@aws-sdk/lib-storage";
import {S3 as $cpgow$S3} from "@aws-sdk/client-s3";










function $ddaa8d734a279805$export$e033206476818195(from, e) {
    try {
        fetch(`https://api.mccreations.net/bamboo/v1/send-log`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: `Encountered error in ${from} \n${new Error().stack} \nError: ${e}`
        });
    } catch (e) {
        console.error(e);
    }
}


const $8fd552124bedf3ec$var$connectionsPool = [];
class $8fd552124bedf3ec$export$6feb5ea51a7b0b47 {
    constructor(databaseName, collectionName){
        if (databaseName) {
            this.database = (0, $e56ccaf93688c7b9$export$388e0302ca0d9a41).db(databaseName);
            this.collection = this.database.collection(collectionName || "");
        } else {
            this.database = (0, $e56ccaf93688c7b9$export$388e0302ca0d9a41).db("content");
            this.collection = this.database.collection("Maps");
        }
        this.createSearchIndex();
    }
    createSearchIndex() {
        this.collection.createIndex({
            title: "text",
            "creators.username": "text",
            shortDescription: "text"
        });
    }
    executeQuery(query) {
        let c = this.collection.find(query.query).limit(query.limit).sort(query.sort).project(query.projection).skip(query.skip);
        return c;
    }
}
class $8fd552124bedf3ec$export$ce44224923f2d626 {
    constructor(query, sort, projection, limit, skip){
        this.query = query || {};
        this.sort = sort || {};
        this.projection = projection || {};
        this.limit = limit || 20;
        this.skip = skip || 0;
    }
    buildQuery(field, value) {
        this.query[field] = value;
    }
    buildQueryWithOperation(field, value, operation) {
        let operator = {};
        operator[operation] = value;
        this.query = {
            ...this.query,
            [field]: operator
        };
    }
    setQuery(query) {
        this.query = query;
    }
    buildSort(field, value) {
        this.sort = {
            [field]: value
        };
    }
    setSort(sort) {
        this.sort = sort;
    }
    setLimit(amount) {
        this.limit = amount;
    }
    setProjection(projection) {
        this.projection = projection;
    }
    setSkip(amount) {
        this.skip = amount;
    }
    createCopy() {
        return new $8fd552124bedf3ec$export$ce44224923f2d626(this.query, this.sort, this.projection, this.limit, this.skip);
    }
}
class $8fd552124bedf3ec$export$4b85d3515bd863a5 {
    constructor(index, query, sort, filter, hitsPerPage, page){
        this.queryS = "";
        this.sortS = "createdDate:desc";
        query && (this.queryS = query);
        sort && (this.sortS = sort);
        this.filterS = filter;
        this.hitsPerPageS = hitsPerPage;
        this.pageS = page;
        try {
            this.client = new (0, $cpgow$MeiliSearch)({
                host: "http://localhost:7700",
                apiKey: "mccreations-search"
            });
            this.index = this.client.index(index);
        } catch (error) {
            (0, $ddaa8d734a279805$export$e033206476818195)("Meilisearch", error);
            console.error(error);
        }
    }
    query(query, add) {
        this.queryS = add ? `${this.queryS} ${query}` : query;
    }
    sort(attr, direction) {
        this.sortS = `${attr}:${direction}`;
    }
    filter(attr, operation, value, combiner) {
        this.filterS = combiner ? `${this.filterS} ${combiner} ${attr}${operation}${value}` : `${attr} ${operation} ${value}`;
    }
    paginate(hitsPerPage, page) {
        this.hitsPerPageS = hitsPerPage;
        this.pageS = page;
    }
    execute() {
        if (!this.client || !this.index) return;
        let options = {};
        if (this.hitsPerPageS) {
            options.hitsPerPage = this.hitsPerPageS;
            options.page = this.pageS;
        }
        if (this.filterS) options.filter = this.filterS;
        if (this.sortS) options.sort = [
            this.sortS
        ];
        return this.index.search(this.queryS, options);
    }
}




function $5e6d52a588086ae2$export$4ca4405bdb01bb32(rating, content) {
    let database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)();
    let totalRating = 0;
    if (content.ratings) content.ratings.push(rating);
    else content.ratings = [
        rating
    ];
    for(let i = 0; i < content.ratings.length; i++)totalRating += content.ratings[i];
    totalRating = totalRating / content.ratings.length;
    database.collection.updateOne({
        slug: content.slug
    }, {
        $push: {
            ratings: rating
        },
        $set: {
            rating: totalRating
        }
    }).then(()=>{
        return totalRating;
    }).catch((error)=>{
        (0, $ddaa8d734a279805$export$e033206476818195)("rateContent", error);
        console.error(error);
        return -1;
    });
}



function $ec8c082ad9cfa5c4$export$5cca2fc2d392520c() {
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).get("/creators", async (req, res)=>{
        let database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)("content", "creators");
        let query = new (0, $8fd552124bedf3ec$export$ce44224923f2d626)();
        query.setProjection({
            password: 0,
            providers: 0
        });
        let cursor = await database.executeQuery(query);
        let documents = [];
        let count = 0;
        for await (const doc of cursor){
            documents.push(doc);
            count++;
        }
        let result = {
            totalCount: count,
            documents: documents
        };
        res.send(result);
    });
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).get("/creator/:handle", async (req, res)=>{
        let database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)("content", "creators");
        let query = new (0, $8fd552124bedf3ec$export$ce44224923f2d626)();
        query.buildQuery("handle", req.params.handle);
        query.setProjection({
            password: 0,
            providers: 0,
            email: 0
        });
        let cursor = await database.executeQuery(query);
        res.send(await cursor.next());
    });
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).post("/rate", async (req, res)=>{
        let rating = await (0, $5e6d52a588086ae2$export$4ca4405bdb01bb32)(Number.parseFloat(req.body.rating), req.body.map);
        res.send({
            rating: rating
        });
    });
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).post("/maps/rate", async (req, res)=>{
        let rating = await (0, $5e6d52a588086ae2$export$4ca4405bdb01bb32)(Number.parseFloat(req.body.rating), req.body.map);
        res.send({
            message: "This route is out of date, please use /rate.",
            rating: rating
        });
    });
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).post("/maps/comment/:slug", async (req, res)=>{
        let database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)();
        let comments = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)("content", "comments");
        let approved = true;
        if ($cpgow$en.some((word)=>req.body.comment.includes(word))) approved = false;
        let comment = await comments.collection.insertOne({
            username: req.body.username,
            comment: req.body.comment,
            date: Date.now(),
            likes: 0,
            handle: req.body.handle,
            approved: approved,
            slug: req.params.slug
        });
        database.collection.updateOne({
            slug: req.params.slug
        }, {
            $push: {
                comments: {
                    _id: comment.insertedId,
                    username: req.body.username,
                    comment: req.body.comment,
                    date: Date.now(),
                    likes: 0,
                    handle: req.body.handle,
                    approved: approved
                }
            }
        });
        res.sendStatus(200);
    });
}






var $2d7f98b468ef9210$export$797a850985de4c33;
(function(Providers) {
    Providers[Providers["Discord"] = 0] = "Discord";
    Providers[Providers["Google"] = 1] = "Google";
    Providers[Providers["Microsoft"] = 2] = "Microsoft";
    Providers[Providers["Github"] = 3] = "Github";
    Providers[Providers["Steam"] = 4] = "Steam";
    Providers[Providers["Apple"] = 5] = "Apple";
})($2d7f98b468ef9210$export$797a850985de4c33 || ($2d7f98b468ef9210$export$797a850985de4c33 = {}));
var $2d7f98b468ef9210$export$df06b7fc047181f5;
(function(UserTypes) {
    UserTypes[UserTypes["Account"] = 0] = "Account";
    UserTypes[UserTypes["Creator"] = 1] = "Creator";
    UserTypes[UserTypes["Admin"] = 2] = "Admin";
})($2d7f98b468ef9210$export$df06b7fc047181f5 || ($2d7f98b468ef9210$export$df06b7fc047181f5 = {}));






(0, $cpgow$sendgridmail).setApiKey("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");
function $3194f3505d176890$export$599d926730c0d987(to, link, title) {
    (0, $cpgow$sendgridmail).send({
        to: to,
        from: "MCCreations <mail@mccreations.net>",
        subject: title + " Has Been Approved!",
        content: [
            {
                type: "text/html",
                value: "blank"
            }
        ],
        templateId: "d-567ca9ab875542f6b34d7ac064865a7d",
        dynamicTemplateData: {
            contentLink: link,
            contentTitle: title
        }
    });
}
function $3194f3505d176890$export$ac49281e03d2b42d(to, resetToken) {
    (0, $cpgow$sendgridmail).send({
        to: to,
        from: "MCCreations <mail@mccreations.net>",
        content: [
            {
                type: "text/html",
                value: "blank"
            }
        ],
        templateId: "d-2d2de0fcb0a94ccc884cf71bd3ff4a7d",
        dynamicTemplateData: {
            email: to,
            resetLink: "https://next.mccreations.net/reset_password?token=" + resetToken
        }
    });
}
function $3194f3505d176890$export$ff99bf209cf80629(link) {
    (0, $cpgow$sendgridmail).send({
        to: "crazycowmm@gmail.com",
        from: "MCCreations <mail@mccreations.net>",
        content: [
            {
                type: "text/html",
                value: "blank"
            }
        ],
        templateId: "d-ae90ac85d7f643b89b5321ebb44756d3",
        dynamicTemplateData: {
            previewContent: link
        }
    });
} // const mailgun = new Mailgun.default(FormData)
 // const mg = mailgun.client({username: 'api', key: process.env.MAILGUN_KEY + ""})
 // export function email(to: string, subject:string, content: string) {
 //     mg.messages.create('mail.mccreations.net', {
 //         from: 'MCCreations <no-reply@mccreations.net>',
 //         to: to,
 //         subject: subject,
 //         text: content
 //     })
 // }
 // function sendEmailTemplate(to: string, template: string, subject: string, variables: any) {
 //     mg.messages.create('mail.mccreations.net', {
 //         from: 'MCCreations <no-reply@mccreations.net>',
 //         to: to,
 //         subject: subject,
 //         template: template,
 //         "t:email": to,
 //         't:variables': JSON.stringify(variables)
 //     }).catch(e => {
 //         throw e;
 //     })
 // }
 // export function forgotPasswordEmail(to: string, resetToken: string) {
 //     try {
 //         sendEmailTemplate(to, "forgot_password", "Password Reset for " + to, {
 //                 email: to,
 //                 resetLink: "https://next.mccreations.net/reset_password?token=" + resetToken
 //             })
 //     } catch (e) {
 //         sendLog("forgotPasswordEmail", e)
 //         throw e;
 //     }
 // }
 // export function requestApprovalEmail(link: string) {
 //     try {
 //         sendEmailTemplate("crazycowmm@gmail.com", "request_approval", "New Map Requesting Approval", {
 //             previewContent: link
 //         })
 //     } catch(e) {
 //         sendLog("requestApprovalEmail", e)
 //         console.log(e)
 //     }
 // }
 // export function approvedEmail(to: string, link: string, title: string) {
 //     try {
 //         sendEmailTemplate(to, "approved", title + " Has Been Approved!", {
 //             contentLink: link,
 //             contentTitle: title
 //         })
 //     } catch(e) {
 //         sendLog("approvedEmail", e)
 //         console.log(e)
 //     }
 // }



const $1b14e0988bb761dd$var$saltRounds = 10;
let $1b14e0988bb761dd$export$be15a7abd999b4ab = "literally1984";
function $1b14e0988bb761dd$export$91166d83cfa6717d() {
    // Get a user from a JWT token sent in the authorization header
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).get("/auth/user", async (req, res)=>{
        if (req.headers.authorization) res.send(await $1b14e0988bb761dd$export$56e97ac19e3a55d5(req.headers.authorization));
        else {
            console.log("authorization not sent");
            res.send({
                error: "You are not allowed to access this resource"
            });
        }
    });
    // app.get('/auth/user/creators', async (req, res) => {
    //     if(req.headers.authorization) {
    //         let user = await getUserFromJWT(req.headers.authorization)
    //         if('user' in user && user.user) {
    //             let creators = [user.user]
    //             let database = new Database('content', 'creators')
    //             let cursor = await database.collection.find<User>({'owners': user.user.handle})
    //             creators = [...creators, ...await cursor.toArray()]
    //             res.send({creators: creators})
    //         } else {
    //             res.send({error: "You are not allowed to access this resource"})
    //         }
    //     } else {
    //         console.log("authorization not sent")
    //         res.send({error: "You are not allowed to access this resource"})
    //     }
    // })
    // Delete a user
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).delete("/auth/user", async (req, res)=>{
        if (req.headers.authorization) try {
            let user = await $1b14e0988bb761dd$export$56e97ac19e3a55d5(req.headers.authorization);
            if (user && user.user) {
                let database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)("content", "creators");
                let result = await database.collection.deleteOne({
                    _id: user.user._id
                });
                if (result.acknowledged && result.deletedCount === 1) res.sendStatus(200);
                else res.send({
                    error: "User not found"
                });
            } else {
                console.log("Token not in JWT");
                res.send({
                    error: "Session expired, please sign in and try again"
                });
            }
        } catch (err) {
            (0, $ddaa8d734a279805$export$e033206476818195)("delete user", err);
            console.log("JWT not verified " + err);
            res.send({
                error: "Session expired, please sign in and try again"
            });
        }
        else {
            console.log("authorization not sent");
            res.send({
                error: "You are not allowed to access this resource"
            });
        }
    });
    // Update a user's profile (username, icon, banner, about)
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).post("/auth/user/updateProfile", async (req, res)=>{
        if (req.headers.authorization) try {
            let user = await $1b14e0988bb761dd$export$56e97ac19e3a55d5(req.headers.authorization);
            if (user && user.user) {
                let database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)("content", "creators");
                if (req.body.banner && req.body.banner.length > 1) await database.collection.updateOne({
                    _id: user.user._id
                }, {
                    $set: {
                        bannerURL: req.body.banner
                    }
                });
                if (req.body.icon && req.body.icon.length > 1) await database.collection.updateOne({
                    _id: user.user._id
                }, {
                    $set: {
                        iconURL: req.body.icon
                    }
                });
                if (req.body.username && req.body.username.length > 1) await database.collection.updateOne({
                    _id: user.user._id
                }, {
                    $set: {
                        username: req.body.username
                    }
                });
                if (req.body.about && req.body.about.length > 1) await database.collection.updateOne({
                    _id: user.user._id
                }, {
                    $set: {
                        about: req.body.about
                    }
                });
                res.sendStatus(200);
            } else {
                console.log("Token not in JWT");
                res.send({
                    error: "Session expired, please sign in and try again"
                });
            }
        } catch (err) {
            (0, $ddaa8d734a279805$export$e033206476818195)("updateProfile", err);
            console.log("JWT not verified");
            res.send({
                error: "Session expired, please sign in and try again"
            });
        }
        else {
            console.log("authorization not sent");
            res.send({
                error: "You are not allowed to access this resource"
            });
        }
    });
    // Update a user's handle
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).post("/auth/user/updateHandle", async (req, res)=>{
        if (req.headers.authorization) try {
            let user = await $1b14e0988bb761dd$export$56e97ac19e3a55d5(req.headers.authorization);
            if (user && user.user) {
                // Change handle
                let database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)("content", "creators");
                let existingUser = await database.collection.findOne({
                    handle: req.body.handle
                });
                if (existingUser) {
                    res.send({
                        error: "Another account is already using that handle"
                    });
                    return;
                }
                await database.collection.updateOne({
                    _id: user.user._id
                }, {
                    $set: {
                        handle: req.body.handle
                    }
                });
                // Update handle in all content
                database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)("content", "Maps");
                await database.collection.updateMany({
                    "creators.handle": user.user.handle
                }, {
                    $set: {
                        "creators.$.handle": req.body.handle
                    }
                });
                database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)("content", "datapacks");
                await database.collection.updateMany({
                    "creators.handle": user.user.handle
                }, {
                    $set: {
                        "creators.$.handle": req.body.handle
                    }
                });
                database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)("content", "resourcepacks");
                await database.collection.updateMany({
                    "creators.handle": user.user.handle
                }, {
                    $set: {
                        "creators.$.handle": req.body.handle
                    }
                });
                database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)("content", "comments");
                await database.collection.updateMany({
                    "handle": user.user.handle
                }, {
                    $set: {
                        "handle": req.body.handle
                    }
                });
                res.sendStatus(200);
            } else {
                console.log("Token not in JWT");
                res.send({
                    error: "Session expired, please sign in and try again"
                });
            }
        } catch (err) {
            (0, $ddaa8d734a279805$export$e033206476818195)("updateHandle", err);
            console.log("JWT not verified");
            res.send({
                error: "Session expired, please sign in and try again"
            });
        }
        else {
            console.log("authorization not sent");
            res.send({
                error: "You are not allowed to access this resource"
            });
        }
    });
    // Update a user's email
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).post("/auth/user/updateEmail", async (req, res)=>{
        if (req.headers.authorization) try {
            let user = await $1b14e0988bb761dd$export$56e97ac19e3a55d5(req.headers.authorization);
            if (user && user.user) {
                let database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)("content", "creators");
                let existingUser = await database.collection.findOne({
                    email: req.body.email
                });
                if (existingUser) {
                    res.send({
                        error: "Another account is already using that email"
                    });
                    return;
                }
                await database.collection.updateOne({
                    _id: user.user._id
                }, {
                    $set: {
                        email: req.body.email,
                        last_important_update: Date.now()
                    }
                });
                res.sendStatus(200);
            } else {
                console.log("Token not in JWT");
                res.send({
                    error: "Session expired, please sign in and try again"
                });
            }
        } catch (err) {
            (0, $ddaa8d734a279805$export$e033206476818195)("updateEmail", err);
            console.log("JWT not verified");
            res.send({
                error: "Session expired, please sign in and try again"
            });
        }
        else {
            console.log("authorization not sent");
            res.send({
                error: "You are not allowed to access this resource"
            });
        }
    });
    // Update a user's password
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).post("/auth/user/updatePassword", async (req, res)=>{
        if (req.headers.authorization) try {
            let user = await $1b14e0988bb761dd$export$56e97ac19e3a55d5(req.headers.authorization);
            if (user && user.user) {
                let database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)("content", "creators");
                (0, $cpgow$bcrypt).hash(req.body.password, $1b14e0988bb761dd$var$saltRounds, async (err, hash)=>{
                    if (err) {
                        res.send({
                            error: "There was an error resetting your password"
                        });
                        return;
                    }
                    await database.collection.updateOne({
                        _id: user.user._id
                    }, {
                        $set: {
                            password: hash,
                            last_important_update: Date.now()
                        }
                    });
                    res.sendStatus(200);
                });
            } else {
                console.log("Token not in JWT");
                res.send({
                    error: "Session expired, please sign in and try again"
                });
            }
        } catch (err) {
            (0, $ddaa8d734a279805$export$e033206476818195)("updatePassword", err);
            console.log("JWT not verified");
            res.send({
                error: "Session expired, please sign in and try again"
            });
        }
        else {
            console.log("authorization not sent");
            res.send({
                error: "You are not allowed to access this resource"
            });
        }
    });
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).post("/auth/resetPassword", async (req, res)=>{
        if (req.headers.authorization) try {
            let user = await $1b14e0988bb761dd$export$56e97ac19e3a55d5(req.headers.authorization);
            if (user && user.user) {
                let database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)("content", "creators");
                if (user && req.body.password) (0, $cpgow$bcrypt).hash(req.body.password, $1b14e0988bb761dd$var$saltRounds, async (err, hash)=>{
                    if (err) {
                        console.error(err);
                        res.send({
                            error: "There was an error resetting your password"
                        });
                        return;
                    }
                    await database.collection.updateOne({
                        _id: user.user._id
                    }, {
                        "$set": {
                            password: hash,
                            last_important_update: Date.now()
                        }
                    });
                    res.sendStatus(200);
                });
                else res.send({
                    error: "User not found; Please request a new reset email"
                });
            } else {
                console.log("Token not in JWT");
                res.send({
                    error: "Token expired; Please request a new reset email"
                });
            }
        } catch (e) {
            (0, $ddaa8d734a279805$export$e033206476818195)("resetPassword", e);
            console.log("JWT not verified");
            res.send({
                error: "Token expired; Please request a new reset email"
            });
        }
        else {
            console.log("authorization not sent");
            res.send({
                error: "You are not allowed to access this resource"
            });
        }
    });
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).post("/auth/forgotPassword", async (req, res)=>{
        if (req.body.email) {
            let database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)("content", "creators");
            let user = await database.collection.findOne({
                email: req.body.email
            });
            if (user) {
                (0, $3194f3505d176890$export$ac49281e03d2b42d)(req.body.email, (0, $cpgow$jsonwebtoken).sign({
                    _id: user._id
                }, $1b14e0988bb761dd$export$be15a7abd999b4ab, {
                    expiresIn: "30min"
                }));
                res.sendStatus(200);
            } else res.send({
                error: "User not found"
            });
        } else res.send({
            error: "Email address not provided"
        });
    });
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).post("/auth/signUpWithEmail", async (req, res)=>{
        let user = req.body;
        let database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)("content", "creators");
        if (!user.password) {
            res.send({
                error: "No password provided"
            });
            return;
        }
        let existingUser = await database.collection.findOne({
            email: user.email
        });
        if (existingUser) {
            res.send({
                error: "Email already in use"
            });
            return;
        }
        (0, $cpgow$bcrypt).hash(user.password, $1b14e0988bb761dd$var$saltRounds, async (err, hash)=>{
            if (err) {
                res.send({
                    error: "There was an error creating your account, please try again"
                });
                return;
            }
            user.password = undefined;
            user.password = hash;
            user.type = (0, $2d7f98b468ef9210$export$df06b7fc047181f5).Account, user.iconURL = "https://next.mccreations.net/mcc_no_scaffold.png";
            existingUser = await database.collection.findOne({
                handle: user.username
            });
            if (existingUser) user.handle = user.username.toLowerCase().replace(" ", "-") + Math.floor(Math.random() * 10000);
            else user.handle = user.username.toLowerCase().replace(" ", "-");
            user.email = user.email.toLowerCase();
            await database.collection.insertOne(user);
            res.send(200);
        });
    });
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).post("/auth/signInWithEmail", async (req, res)=>{
        let user = req.body;
        let database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)("content", "creators");
        if (!user.password) {
            res.send({
                error: "No password provided"
            });
            return;
        }
        let existingUser = await database.collection.findOne({
            email: user.email
        });
        if (!existingUser) {
            res.send({
                error: "Incorrect email address or password"
            });
            return;
        }
        if (!existingUser.password) {
            res.send({
                error: "Incorrect email address or password"
            });
            return;
        }
        (0, $cpgow$bcrypt).compare(user.password, existingUser.password, (err, same)=>{
            if (same) {
                console.log("user login successful");
                res.send({
                    token: (0, $cpgow$jsonwebtoken).sign({
                        _id: existingUser._id,
                        createdDate: Date.now()
                    }, $1b14e0988bb761dd$export$be15a7abd999b4ab, {
                        expiresIn: "31d"
                    }),
                    creator: {
                        username: existingUser.username,
                        handle: existingUser.handle
                    }
                });
            } else res.send({
                error: "Incorrect email address or password"
            });
        });
    });
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).post("/auth/signInWithDiscord", async (req, res)=>{
        let result = await $1b14e0988bb761dd$var$signInWithDiscord(req.query.code);
        if ($1b14e0988bb761dd$var$instanceOfUser(result)) {
            result;
            res.send({
                token: (0, $cpgow$jsonwebtoken).sign({
                    _id: result._id,
                    createdDate: Date.now()
                }, $1b14e0988bb761dd$export$be15a7abd999b4ab, {
                    expiresIn: "31d"
                }),
                creator: {
                    username: result.username
                }
            });
        } else {
            console.log(result);
            res.send(result);
        // res.sendStatus(500)
        }
    });
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).post("/auth/signInWithGithub", async (req, res)=>{
        let result = await $1b14e0988bb761dd$var$signInWithGithub(req.query.code);
        if ($1b14e0988bb761dd$var$instanceOfUser(result)) {
            result;
            res.send({
                token: (0, $cpgow$jsonwebtoken).sign({
                    _id: result._id,
                    createdDate: Date.now()
                }, $1b14e0988bb761dd$export$be15a7abd999b4ab, {
                    expiresIn: "31d"
                }),
                creator: {
                    username: result.username,
                    handle: result.handle
                }
            });
        } else {
            console.log(result);
            res.send(result);
        // res.sendStatus(500)
        }
    });
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).post("/auth/signInWithGoogle", async (req, res)=>{
        let result = await $1b14e0988bb761dd$var$signInWithGoogle(req.query.access_token);
        if ($1b14e0988bb761dd$var$instanceOfUser(result)) {
            result;
            res.send({
                token: (0, $cpgow$jsonwebtoken).sign({
                    _id: result._id,
                    createdDate: Date.now()
                }, $1b14e0988bb761dd$export$be15a7abd999b4ab, {
                    expiresIn: "31d"
                }),
                creator: {
                    username: result.username,
                    handle: result.handle
                }
            });
        } else {
            console.log(result);
            res.send(result);
        }
    });
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).post("/auth/signInWithMicrosoft", async (req, res)=>{
        let result = await $1b14e0988bb761dd$var$signInWithMicrosoft(req.query.code);
        if ($1b14e0988bb761dd$var$instanceOfUser(result)) {
            result;
            res.send({
                token: (0, $cpgow$jsonwebtoken).sign({
                    _id: result._id,
                    createdDate: Date.now()
                }, $1b14e0988bb761dd$export$be15a7abd999b4ab, {
                    expiresIn: "31d"
                }),
                creator: {
                    username: result.username,
                    handle: result.handle
                }
            });
        } else {
            console.log(result);
            res.send(result);
        }
    });
}
async function $1b14e0988bb761dd$var$signInWithDiscord(code) {
    let res = await fetch("https://discord.com/api/oauth2/token", {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
            "client_id": "882869275063386153",
            "client_secret": "iRLt58vpsYscUVpePGAurWaWgnXNucfB",
            code: code,
            "grant_type": "authorization_code",
            "redirect_uri": "https://next.mccreations.net/auth/oauth_handler?provider=discord",
            "scope": "identify+email"
        }).toString(),
        method: "POST"
    });
    let data = await res.json();
    let access_token = data.access_token;
    let token_type = data.token_type;
    let refresh_token = data.refresh_token;
    if (!access_token) return {
        error: "Access token was not received "
    };
    res = await fetch("https://discord.com/api/users/@me", {
        headers: {
            authorization: `${token_type} ${access_token}`
        }
    });
    let discordUser = await res.json();
    if (!discordUser) return {
        error: "Discord user could not be fetched"
    };
    const database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)("content", "creators");
    let existingUser = await database.collection.findOne({
        "providers.id": discordUser.id
    });
    if (existingUser) {
        existingUser.providers?.forEach((provider)=>{
            if (provider.provider === (0, $2d7f98b468ef9210$export$797a850985de4c33).Discord) provider.token = access_token, provider.refreshToken = refresh_token;
        });
        return existingUser;
    } else {
        existingUser = await database.collection.findOne({
            email: discordUser.email
        });
        if (existingUser) return {
            error: "User already exists but is using a different provider"
        };
        else {
            let user = {
                username: discordUser.global_name,
                email: discordUser.email,
                type: (0, $2d7f98b468ef9210$export$df06b7fc047181f5).Account,
                iconURL: `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}`,
                bannerURL: `https://cdn.discordapp.com/banners/${discordUser.id}/${discordUser.banner}`,
                providers: [
                    {
                        provider: (0, $2d7f98b468ef9210$export$797a850985de4c33).Discord,
                        token: access_token,
                        refreshToken: refresh_token,
                        id: discordUser.id
                    }
                ]
            };
            existingUser = await database.collection.findOne({
                handle: user.username
            });
            if (existingUser) user.handle = user.username.toLowerCase().replace(" ", "-") + Math.floor(Math.random() * 10000);
            else user.handle = user.username.toLowerCase().replace(" ", "-");
            await database.collection.insertOne(user);
            return user;
        }
    }
}
async function $1b14e0988bb761dd$var$signInWithGithub(code) {
    let githubParams = new URLSearchParams({
        client_id: "d8fb2f8d7b4f8f88c320",
        client_secret: "5b24a7011c4db6ba6b5feec392e5f21103ea8225",
        code: code,
        scope: "user:email,read:user"
    });
    let res = await fetch(`https://github.com/login/oauth/access_token?${githubParams.toString()}`, {
        headers: {
            "Accept": "application/json"
        },
        method: "POST"
    });
    let data = await res.json();
    console.log(data);
    // console.log(data.access_token)
    let access_token = data.access_token;
    let token_type = data.token_type;
    if (!access_token) return {
        error: "Access token was not received "
    };
    res = await fetch("https://api.github.com/user", {
        headers: {
            authorization: `${token_type} ${access_token}`
        }
    });
    let githubUser = await res.json();
    if (!githubUser) return {
        error: "Github user could not be fetched"
    };
    const database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)("content", "creators");
    let existingUser = await database.collection.findOne({
        "providers.id": githubUser.id
    });
    if (existingUser) {
        existingUser.providers?.forEach((provider)=>{
            if (provider.provider === (0, $2d7f98b468ef9210$export$797a850985de4c33).Github) provider.token = access_token;
        });
        return existingUser;
    } else {
        existingUser = await database.collection.findOne({
            email: githubUser.email
        });
        if (existingUser && githubUser.email) return {
            error: "User already exists but is using a different provider"
        };
        else {
            let user = {
                username: githubUser.login,
                email: githubUser.email,
                type: (0, $2d7f98b468ef9210$export$df06b7fc047181f5).Account,
                iconURL: githubUser.avatar_url,
                providers: [
                    {
                        provider: (0, $2d7f98b468ef9210$export$797a850985de4c33).Github,
                        token: access_token,
                        refreshToken: "",
                        id: githubUser.id
                    }
                ]
            };
            existingUser = await database.collection.findOne({
                handle: user.username
            });
            if (existingUser) user.handle = user.username.toLowerCase().replace(" ", "-") + Math.floor(Math.random() * 10000);
            else user.handle = user.username.toLowerCase().replace(" ", "-");
            await database.collection.insertOne(user);
            return user;
        }
    }
}
async function $1b14e0988bb761dd$var$signInWithGoogle(access_token) {
    let res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: {
            authorization: "Bearer " + access_token
        }
    });
    let data = await res.json();
    const database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)("content", "creators");
    let existingUser = await database.collection.findOne({
        "providers.id": data.id
    });
    if (existingUser) {
        existingUser.providers?.forEach((provider)=>{
            if (provider.provider === (0, $2d7f98b468ef9210$export$797a850985de4c33).Github) provider.token = access_token;
        });
        return existingUser;
    } else {
        existingUser = await database.collection.findOne({
            email: data.email
        });
        if (existingUser && data.email) return {
            error: "User already exists but is using a different provider"
        };
        else {
            let user = {
                username: data.name,
                email: data.email,
                type: (0, $2d7f98b468ef9210$export$df06b7fc047181f5).Account,
                iconURL: data.picture,
                providers: [
                    {
                        provider: (0, $2d7f98b468ef9210$export$797a850985de4c33).Google,
                        token: access_token,
                        refreshToken: "",
                        id: data.id
                    }
                ]
            };
            existingUser = await database.collection.findOne({
                handle: user.username
            });
            if (existingUser) user.handle = user.username.toLowerCase().replace(" ", "-") + Math.floor(Math.random() * 10000);
            else user.handle = user.username.toLowerCase().replace(" ", "-");
            await database.collection.insertOne(user);
            return user;
        }
    }
}
async function $1b14e0988bb761dd$var$signInWithMicrosoft(code) {
    let res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
            "client_id": "f4c0f386-febc-4e8e-b0d5-20a99b4d0667",
            "client_secret": "Rao8Q~FVIUeFC7PbsB0MqEhbReoKbUtcrCJnqdos",
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": "https://next.mccreations.net/auth/oauth_handler",
            "scope": "openid email profile"
        }).toString(),
        method: "POST"
    });
    let data = await res.json();
    let access_token = data.access_token;
    let token_type = data.token_type;
    res = await fetch("https://graph.microsoft.com/oidc/userinfo", {
        headers: {
            authorization: `${token_type} ${access_token}`
        }
    });
    let microsoftUser = await res.json();
    if (!microsoftUser) return {
        error: "Github user could not be fetched"
    };
    const database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)("content", "creators");
    let existingUser = await database.collection.findOne({
        "providers.id": microsoftUser.sub
    });
    if (existingUser) {
        existingUser.providers?.forEach((provider)=>{
            if (provider.provider === (0, $2d7f98b468ef9210$export$797a850985de4c33).Github) provider.token = access_token;
        });
        return existingUser;
    } else {
        existingUser = await database.collection.findOne({
            email: microsoftUser.email
        });
        if (existingUser && microsoftUser.email) return {
            error: "User already exists but is using a different provider"
        };
        else {
            let user = {
                username: microsoftUser.name,
                email: microsoftUser.email,
                type: (0, $2d7f98b468ef9210$export$df06b7fc047181f5).Account,
                providers: [
                    {
                        provider: (0, $2d7f98b468ef9210$export$797a850985de4c33).Microsoft,
                        token: access_token,
                        refreshToken: "",
                        id: microsoftUser.sub
                    }
                ]
            };
            existingUser = await database.collection.findOne({
                handle: user.username
            });
            if (existingUser) user.handle = (user.username.toLowerCase() + Math.floor(Math.random() * 10000)).replace(" ", "-");
            else user.handle = user.username.toLowerCase().replace(" ", "-");
            await database.collection.insertOne(user);
            return user;
        }
    }
}
async function $1b14e0988bb761dd$export$56e97ac19e3a55d5(jwtString) {
    try {
        let token = (0, $cpgow$jsonwebtoken).verify(jwtString, $1b14e0988bb761dd$export$be15a7abd999b4ab);
        if (token && token._id) {
            let _id = new (0, $cpgow$ObjectId)(token._id);
            let database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)("content", "creators");
            let query = new (0, $8fd552124bedf3ec$export$ce44224923f2d626)();
            query.buildQuery("_id", _id);
            query.setProjection({
                password: 0,
                providers: 0
            });
            let cursor = await database.executeQuery(query);
            let user = await cursor.next();
            if (user && (user.last_important_update && token.createdDate && user.last_important_update < token.createdDate || !user.last_important_update)) return {
                user: user
            };
            else {
                console.log("User not found");
                return {
                    error: "Session expired, please sign in and try again"
                };
            }
        } else {
            console.log("Token not in JWT");
            return {
                error: "Session expired, please sign in and try again"
            };
        }
    } catch (err) {
        (0, $ddaa8d734a279805$export$e033206476818195)("getUserFromJWT", err + "\n JWT: " + jwtString);
        console.log("JWT not verified");
        return {
            error: "Session expired, please sign in and try again"
        };
    }
}
function $1b14e0988bb761dd$export$ee00985da96cc670(jwtString) {
    console.log(jwtString);
    try {
        let token = (0, $cpgow$jsonwebtoken).verify(jwtString, $1b14e0988bb761dd$export$be15a7abd999b4ab);
        if (token && token._id) return new (0, $cpgow$ObjectId)(token._id);
    } catch (e) {
        (0, $ddaa8d734a279805$export$e033206476818195)("getIdFromJWT", e + "\n JWT: " + jwtString);
        console.log("JWT Error: " + e);
        return {
            error: "Session expired, please sign in and try again"
        };
    }
}
function $1b14e0988bb761dd$var$instanceOfUser(object) {
    return "username" in object;
}
async function $1b14e0988bb761dd$export$8fb3ef6296d15f5() {
    $1b14e0988bb761dd$export$be15a7abd999b4ab = (await crypto.getRandomValues(new Uint8Array(256))).join("");
}


var $5c8a9d7e3bf31635$export$147b480b3694c1f3;
(function(SearchIndex) {
    SearchIndex["Maps"] = "maps";
    SearchIndex["Datapacks"] = "datapacks";
    SearchIndex["Resourcepacks"] = "resourcepacks";
})($5c8a9d7e3bf31635$export$147b480b3694c1f3 || ($5c8a9d7e3bf31635$export$147b480b3694c1f3 = {}));
var $5c8a9d7e3bf31635$export$9cd4fe417e96c8ae;
(function(DatabaseCollection) {
    DatabaseCollection["Maps"] = "Maps";
    DatabaseCollection["Datapacks"] = "datapacks";
    DatabaseCollection["Resourcepacks"] = "resourcepacks";
})($5c8a9d7e3bf31635$export$9cd4fe417e96c8ae || ($5c8a9d7e3bf31635$export$9cd4fe417e96c8ae = {}));






async function $7df0703b6b9e6f41$export$b216673dc84b1f1e(collection, requestQuery, useProjection) {
    let database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)("content", collection);
    let query = new (0, $8fd552124bedf3ec$export$ce44224923f2d626)();
    switch(requestQuery.sort){
        case "newest":
            query.buildSort("createdDate", -1);
            break;
        case "updated":
            query.buildSort("updatedDate", -1);
            break;
        case "title_ascending":
            query.buildSort("title", 1);
            break;
        case "title_descending":
            query.buildSort("title", -1);
            break;
        case "oldest":
            query.buildSort("createdDate", 1);
            break;
        case "highest_rated":
            query.buildSort("rating", -1);
            break;
        case "lowest_rated":
            query.buildSort("rating", 1);
            break;
        case "creator_ascending":
            query.buildSort("creators.username", 1);
            break;
        case "creator_descending":
            query.buildSort("creators.username", -1);
            break;
        // case "best_match": 
        // 	sort = {score: {$meta: "textScore"}}
        // 	break;
        default:
            query.buildSort("createdDate", -1);
    }
    if (requestQuery.status && (!requestQuery.exclusiveStatus || requestQuery.exclusiveStatus === "false")) {
        console.log(requestQuery.status);
        query.buildQueryWithOperation("status", Number.parseInt(requestQuery.status), "$gte");
    } else if (requestQuery.status) query.buildQuery("status", Number.parseInt(requestQuery.status));
    if (requestQuery.version) {
        requestQuery.version.replace(".0", "");
        query.buildQuery("files.minecraftVersion", requestQuery.version);
    }
    if (requestQuery.search && requestQuery.search.length > 3 && !(requestQuery.search === "undefined" || requestQuery.search === "null")) query.buildQueryWithOperation("$text", requestQuery.search, "$search");
    if (requestQuery.slug) query.buildQuery("slug", requestQuery.slug);
    if (requestQuery.limit) query.setLimit(Number.parseInt(requestQuery.limit));
    else requestQuery.setLimit(20);
    if (query.limit === 0) query.setLimit(20);
    if (requestQuery.page) {
        if (requestQuery.page < 0) requestQuery.page = "0";
        query.setSkip(Number.parseInt(requestQuery.page) * query.limit);
    }
    if (requestQuery.creator) query.buildQuery("creators.handle", requestQuery.creator);
    const projection = {
        title: 1,
        // score: { $meta: "textScore" },
        "files.minecraftVersion": 1,
        shortDescription: 1,
        downloads: 1,
        views: 1,
        rating: 1,
        creators: 1,
        images: 1,
        slug: 1,
        createdDate: 1,
        status: 1
    };
    if (useProjection) query.setProjection(projection);
    let count = await database.collection.countDocuments(query.query);
    let cursor = database.executeQuery(query);
    let documents = [];
    for await (const doc of cursor)documents.push(doc);
    let result = {
        totalCount: count,
        documents: documents
    };
    return result;
}
async function $7df0703b6b9e6f41$export$6d5eb2b1056739cf(index, requestQuery) {
    let search = new (0, $8fd552124bedf3ec$export$4b85d3515bd863a5)(index);
    switch(requestQuery.sort){
        case "newest":
            search.sort("createdDate", "desc");
            break;
        case "updated":
            search.sort("updatedDate", "desc");
            break;
        case "title_ascending":
            search.sort("title", "asc");
            break;
        case "title_descending":
            search.sort("title", "desc");
            break;
        case "oldest":
            search.sort("createdDate", "asc");
            break;
        case "highest_rated":
            search.sort("rating", "desc");
            break;
        case "lowest_rated":
            search.sort("rating", "asc");
            break;
        case "creator_ascending":
            search.sort("creators.username", "asc");
            break;
        case "creator_descending":
            search.sort("creators.username", "desc");
            break;
        // case "best_match": 
        // 	sort = {score: {$meta: "textScore"}}
        // 	break;
        default:
            search.sort("createdDate", "desc");
            break;
    }
    if (requestQuery.status && (!requestQuery.exclusiveStatus || requestQuery.exclusiveStatus === "false")) search.filter("status", ">=", Number.parseInt(requestQuery.status));
    else if (requestQuery.status) search.filter("status", "=", Number.parseInt(requestQuery.status));
    else search.filter("status", ">=", 2);
    if (requestQuery.version) {
        requestQuery.version.replace(".0", "");
        search.filter("files.minecraftVersion", "=", requestQuery.version);
    }
    if (requestQuery.search && !(requestQuery.search === "undefined" || requestQuery.search === "null")) search.query(requestQuery.search, false);
    if (requestQuery.limit && requestQuery.page) search.paginate(Number.parseInt(requestQuery.limit), Number.parseInt(requestQuery.page) + 1);
    if (requestQuery.includeTags) {
        let tags = requestQuery.includeTags.split(",");
        for (const tag of tags)search.filter("tags", "=", tag, "AND");
    }
    if (requestQuery.excludeTags) {
        let tags = requestQuery.excludeTags.split(",");
        for (const tag of tags)search.filter("tags", "!=", tag, "AND");
    }
    let documents = await search.execute()?.catch((e)=>{
        console.error(e);
        (0, $ddaa8d734a279805$export$e033206476818195)("performSearch", e);
    });
    if (!documents) {
        console.error("Meilisearch is probably not initialized.");
        return {
            totalCount: 0,
            documents: []
        };
    }
    return {
        totalCount: search.hitsPerPageS ? documents.totalHits : documents.estimatedTotalHits,
        documents: documents.hits.map((doc)=>doc)
    };
}


function $d528be0e4428fb13$export$546c0cedea069764() {
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).get("/maps", async (req, res)=>{
        let result = await (0, $7df0703b6b9e6f41$export$6d5eb2b1056739cf)((0, $5c8a9d7e3bf31635$export$147b480b3694c1f3).Maps, req.query);
        let user = await (0, $1b14e0988bb761dd$export$56e97ac19e3a55d5)(req.headers.authorization + "");
        result.documents = result.documents.filter((map)=>{
            if (map.status < 2) {
                if (user.user && map.creators) for (const creator of map.creators){
                    if (creator.handle === user.user.handle) return true;
                }
                else {
                    let id = (0, $1b14e0988bb761dd$export$ee00985da96cc670)(req.headers.authorization + "");
                    if (id && id instanceof (0, $cpgow$ObjectId) && id.equals(map._id)) return true;
                }
                return false;
            }
            return true;
        });
        if (req.query.sendCount && req.query.sendCount === "true") res.send({
            count: result.totalCount
        });
        else res.send(result);
    });
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).get("/maps-nosearch", async (req, res)=>{
        let result = await (0, $7df0703b6b9e6f41$export$b216673dc84b1f1e)((0, $5c8a9d7e3bf31635$export$9cd4fe417e96c8ae).Maps, req.query, false);
        let user = await (0, $1b14e0988bb761dd$export$56e97ac19e3a55d5)(req.headers.authorization + "");
        result.documents = result.documents.filter((map)=>{
            if (map.status < 2) {
                if (user.user && map.creators) {
                    if (user.user.type === (0, $2d7f98b468ef9210$export$df06b7fc047181f5).Admin) return true;
                    for (const creator of map.creators){
                        if (creator.handle === user.user.handle) return true;
                    }
                } else {
                    let id = (0, $1b14e0988bb761dd$export$ee00985da96cc670)(req.headers.authorization + "");
                    if (id && id instanceof (0, $cpgow$ObjectId) && id.equals(map._id)) return true;
                }
                return false;
            }
            return true;
        });
        if (req.query.sendCount && req.query.sendCount === "true") res.send({
            count: result.totalCount
        });
        else res.send(result);
    });
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).get("/maps/:slug", async (req, res)=>{
        let result = await (0, $7df0703b6b9e6f41$export$b216673dc84b1f1e)((0, $5c8a9d7e3bf31635$export$9cd4fe417e96c8ae).Maps, {
            limit: 1,
            slug: req.params.slug
        }, false);
        if (result.documents[0] && result.documents[0].status < 1) {
            let filter = true;
            if (req.headers.authorization) {
                let uObj = await (0, $1b14e0988bb761dd$export$56e97ac19e3a55d5)(req.headers.authorization);
                if (uObj.user && result.documents[0].creators) {
                    for (const creator of result.documents[0].creators)if (creator.handle === uObj.user.handle) filter = false;
                    if (uObj.user.type === (0, $2d7f98b468ef9210$export$df06b7fc047181f5).Admin) filter = false;
                } else {
                    let id = (0, $1b14e0988bb761dd$export$ee00985da96cc670)(req.headers.authorization);
                    if (id && id instanceof (0, $cpgow$ObjectId) && id.equals(result.documents[0]._id)) filter = false;
                }
            }
            if (filter) {
                res.send({
                    error: "Map does not exist, or you do not have permission to view it"
                });
                return;
            }
        }
        if (result.documents.length !== 1) {
            res.send({
                error: "Map does not exist, or you do not have permission to view it"
            });
            return;
        }
        res.send(result.documents[0]);
    });
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).get("/maps/:slug/download", async (req, res)=>{
        let result = await (0, $7df0703b6b9e6f41$export$b216673dc84b1f1e)((0, $5c8a9d7e3bf31635$export$9cd4fe417e96c8ae).Maps, {
            limit: 1,
            slug: req.params.slug
        }, false);
        if (result.documents[0]) {
            let map = result.documents[0];
            let database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)();
            database.collection.updateOne({
                _id: map._id
            }, {
                $inc: {
                    downloads: 1
                }
            });
            res.sendStatus(200);
            return;
        }
        res.sendStatus(404);
    });
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).get("/maps/:slug/comments", async (req, res)=>{
        let result = await (0, $7df0703b6b9e6f41$export$b216673dc84b1f1e)((0, $5c8a9d7e3bf31635$export$9cd4fe417e96c8ae).Maps, {
            limit: 1,
            slug: req.params.slug
        }, false);
        if (result.documents[0]) {
            let map = result.documents[0];
            res.send({
                comments: map.comments
            });
            return;
        }
        res.sendStatus(404);
    });
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).get("/maps/:slug/stats", async (req, res)=>{
        let result = await (0, $7df0703b6b9e6f41$export$b216673dc84b1f1e)((0, $5c8a9d7e3bf31635$export$9cd4fe417e96c8ae).Maps, {
            limit: 1,
            slug: req.params.slug
        }, false);
        if (result.documents[0]) {
            let map = result.documents[0];
            res.send({
                downloads: map.downloads,
                ratings: map.ratings,
                rating: map.rating,
                views: map.views
            });
            return;
        }
        res.sendStatus(404);
    });
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).get("/get_map_tags", async (req, res)=>{
        res.send({
            genre: [
                "adventure",
                "parkour",
                "survival",
                "puzzle",
                "game",
                "build"
            ],
            subgenre: [
                "horror",
                "PVE",
                "PVP",
                "episodic",
                "challenge",
                "CTM",
                "RPG",
                "trivia",
                "escape",
                "finding",
                "maze",
                "unfair",
                "dropper",
                "elytra",
                "city",
                "park",
                "multiplayer",
                "singleplayer",
                "co-op"
            ],
            difficulty: [
                "chill",
                "easy",
                "normal",
                "hard",
                "hardcore"
            ],
            theme: [
                "medieval",
                "modern",
                "fantasy",
                "sci-fi",
                "realistic",
                "vanilla"
            ],
            length: [
                "short",
                "medium",
                "long"
            ]
        });
    });
}











const $f9c6f11267aa3451$var$client = new (0, $cpgow$MongoClient)("mongodb+srv://app-test:%40pp-t@mccreations.454k0cx.mongodb.net/?retryWrites=true&w=majority&appName=AtlasApp", {
    serverApi: {
        version: (0, $cpgow$ServerApiVersion).v1,
        strict: true,
        deprecationErrors: true
    }
});
async function $f9c6f11267aa3451$export$4b50f199f448c5e() {
    const collection = $f9c6f11267aa3451$var$client.db("content").collection("Maps");
    let cursor = collection.find({});
    let documents = [];
    for await (const doc of cursor){
        let timestampInMilliseconds = Date.parse(doc.createdDate);
        let timestamp = timestampInMilliseconds / 1000;
        doc.createdDate = timestamp;
        timestampInMilliseconds = Date.parse(doc.updatedDate);
        timestamp = timestampInMilliseconds / 1000;
        doc.updatedDate = timestamp;
        documents.push(doc);
    }
    $f9c6f11267aa3451$var$client.close();
    fetch("http://localhost:7700/indexes/maps/documents?primaryKey=_id", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer mccreations-search"
        },
        body: JSON.stringify(documents)
    });
}












const $b1da0f8d9d83dacd$var$bucket = new (0, $cpgow$S3)({
    region: "us-west-1",
    credentials: {
        accessKeyId: "AKIAYSX7P4GVL54HBGX7",
        secretAccessKey: "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"
    }
});
async function $b1da0f8d9d83dacd$export$a3c8e1472dc2ed84(file, name) {
    name = name + Math.floor(Math.random() * 1000);
    const params = {
        Bucket: "mccreations",
        Key: name,
        Body: file
    };
    try {
        const u = new (0, $cpgow$Upload)({
            client: $b1da0f8d9d83dacd$var$bucket,
            params: params
        });
        await u.done().catch((e)=>{
            (0, $ddaa8d734a279805$export$e033206476818195)("upload", e);
            console.error(e);
        });
        return "https://mccreations.s3.us-west-1.amazonaws.com/" + name;
    } catch (error) {
        (0, $ddaa8d734a279805$export$e033206476818195)("upload", error);
        return error;
    }
}



async function $cfdaccb57129ec62$export$b048f1436ab4c611(collection, body, uploader) {
    let database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)("content", collection);
    let slug = body.content.title.toLowerCase().replace(/\s/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
    console.log("Slug: " + slug);
    let i = "";
    let isSlugUnique = await $cfdaccb57129ec62$export$a5c22ef5cdb863ae(slug, collection);
    while(!isSlugUnique){
        i += (Math.random() * 100).toFixed(0);
        isSlugUnique = await $cfdaccb57129ec62$export$a5c22ef5cdb863ae(slug + i, collection);
    }
    slug = slug + i;
    let content = {
        title: body.content.title,
        shortDescription: body.content.summary,
        description: "",
        images: [],
        status: 0,
        downloads: 0,
        views: 0,
        slug: slug,
        rating: 0,
        createdDate: new Date(Date.now())
    };
    console.log("Attempting to insert map");
    let result = await database.collection.insertOne(content);
    console.log("Map inserted");
    if (uploader) {
        database.collection.updateOne({
            _id: result.insertedId
        }, {
            $push: {
                creators: {
                    username: uploader.username,
                    handle: uploader.handle
                }
            }
        });
        return {
            slug: content.slug
        };
    } else {
        console.log("No user, creating temporary access key");
        let key = (0, $cpgow$jsonwebtoken).sign({
            _id: result.insertedId.toJSON()
        }, (0, $1b14e0988bb761dd$export$be15a7abd999b4ab), {
            expiresIn: "24h"
        });
        return {
            key: key,
            slug: content.slug
        };
    }
}
async function $cfdaccb57129ec62$export$18e125b1371a483(url) {
    let res = await (0, $cpgow$axios).get(url);
    let html = new (0, $cpgow$JSDOM)(res.data).window.document;
    let title = html.querySelector("div#resource-title-text h1")?.textContent?.trim();
    if (!title) return;
    let slug = title.toLowerCase().replace(/\s/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
    let description = html.querySelector("#r-text-block")?.innerHTML;
    if (!description) return;
    let shortDescription = "";
    let status = 0;
    let downloads = 0;
    let views = 0;
    let rating = 0;
    let createdDate = new Date();
    let users = html.querySelectorAll(".pusername");
    let username = "";
    if (users.length === 1) username = html.querySelectorAll(".pusername")[0].textContent + "";
    else username = html.querySelectorAll(".pusername")[1].textContent + "";
    let map = {
        title: title,
        slug: slug,
        description: description,
        shortDescription: shortDescription,
        status: status,
        downloads: downloads,
        views: views,
        rating: rating,
        createdDate: createdDate,
        images: [],
        creators: [
            {
                username: username
            }
        ],
        importedUrl: url
    };
    map.files = [
        {
            type: "world",
            worldUrl: "https://www.planetminecraft.com" + html.querySelector(".branded-download")?.getAttribute("href"),
            minecraftVersion: ""
        }
    ];
    let images = html.querySelectorAll(".rsImg");
    images.forEach(async (image, idx)=>{
        let url = image.getAttribute("href");
        map.images.push(url);
    });
    // await loadAndTransferImages(map)
    return map;
}
async function $cfdaccb57129ec62$export$b16f51c1b1e87afb(url) {
    const mapInfoLocator = "Map Info</h2>\n</center></td>\n</tr>\n</tbody>\n</table>";
    const pictureLocator = '<table style="width: 100%;" border="0" cellspacing="0" cellpadding="0">\n<tbody>\n<tr>\n<td class="info_title"><center>\n<h2>Pictures</h2>\n</center></td>\n</tr>\n</tbody>\n</table>';
    const changelogLocator = '<table border="0" width="98%" cellspacing="0" cellpadding="0">\n<tbody>\n<tr>\n<td class="info_title">\n<h2><center>Changelog</center></h2>\n</td>\n</tr>\n</tbody>\n</table>';
    let res = await (0, $cpgow$axios).get(url);
    let html = new (0, $cpgow$JSDOM)(res.data).window.document;
    let descTable = html.querySelector("table")?.querySelector("table")?.querySelector("td")?.innerHTML;
    let statsPanel = html.querySelector("div.stats_data")?.querySelectorAll("table")[1];
    if (!descTable) return;
    let mapInfoStart = descTable.indexOf(mapInfoLocator);
    let pictureStart = descTable.indexOf(pictureLocator);
    let changelogStart = descTable.indexOf(changelogLocator);
    let title = html.querySelector("h1")?.textContent?.trim();
    if (!title) return;
    let slug = title.toLowerCase().replace(/\s/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
    let description = "";
    if (descTable.includes(pictureLocator)) description = descTable.substring(mapInfoStart + mapInfoLocator.length, pictureStart);
    else description = descTable.substring(mapInfoStart + mapInfoLocator.length, changelogStart);
    description.replace(/\<table style="width: 98%;" border="0" cellspacing="0" cellpadding="0"\>\n\<tbody\>\n\<tr>\n\<td class="info_title"><center>/g, "");
    description.replace(/\<\/center\>\<\/td\>\n\<\/tr\>\n\<\/tbody\>\n\<\/table>/g, "");
    let shortDescription = "";
    let status = 0;
    let downloads = 0;
    let views = 0;
    let rating = 0;
    let createdDate = new Date();
    let username = statsPanel?.querySelectorAll("tr")[0].querySelectorAll("span")[1].textContent + "";
    let map = {
        title: title,
        slug: slug,
        description: description,
        shortDescription: shortDescription,
        status: status,
        downloads: downloads,
        views: views,
        rating: rating,
        createdDate: createdDate,
        images: [],
        creators: [
            {
                username: username
            }
        ],
        importedUrl: url
    };
    map.files = [
        {
            type: "world",
            worldUrl: "https://minecraftmaps.com" + html.querySelector(".jdbutton")?.getAttribute("href"),
            minecraftVersion: statsPanel?.querySelectorAll("tr")[3].querySelectorAll("span")[1].textContent + "",
            contentVersion: statsPanel?.querySelectorAll("tr")[2].querySelectorAll("span")[1].textContent + ""
        }
    ];
    let images = html.querySelector("table")?.querySelector("table")?.querySelector("td")?.querySelectorAll("img");
    map.images.push(html.querySelector(".map-images")?.getAttribute("src"));
    if (images) images.forEach(async (image, idx)=>{
        let url = image.getAttribute("data-src");
        // try {
        //     let response = await axios.get(url);
        //     let buffer = await response.data;
        //     upload(new Uint8Array(buffer), `${map.slug}_image_${idx}${url.substring(url.lastIndexOf('.'))}`);
        //     map.images.push(`https://mccreations.s3.us-west-1.amazonaws.com/${map.slug}_image_${idx}${url.substring(url.lastIndexOf('.'))}`)
        // } catch(e) {
        map.images.push(url);
    // }
    });
    // await loadAndTransferImages(map)
    return map;
}
async function $cfdaccb57129ec62$export$4423b9fb0ce653d(map) {
    try {
        (0, $cpgow$puppeteer).launch().then(async (browser)=>{
            try {
                let idx = 0;
                let fileCounter = 0;
                let uploaded_images = [];
                let timeoutSeconds = 30;
                const page = await browser.newPage();
                page.on("response", async (response)=>{
                    try {
                        const matches = /.*\.(jpg|png|svg|gif|webp)$/.exec(response.url());
                        if (matches && matches.length === 2 && (response.url().startsWith("https://www.minecraftmaps.com/images/jdownloads/screenshots/") || response.url().startsWith("https://static.planetminecraft.com/files/image/minecraft/"))) {
                            console.log(matches);
                            const extension = matches[1];
                            const buffer = await response.buffer();
                            fileCounter += 1;
                            let url = await (0, $b1da0f8d9d83dacd$export$a3c8e1472dc2ed84)(buffer, `${map.slug}_image_${fileCounter}.${extension}`);
                            uploaded_images.push({
                                transferredUrl: url,
                                originalUrl: response.url()
                            });
                        }
                    } catch (e) {
                        console.log("Error uploading image: " + e);
                    }
                });
                await page.goto(map.importedUrl);
                try {
                    // page.mouse.wheel({deltaY: 2000})
                    while(uploaded_images.length < map.images.length && timeoutSeconds > 0){
                        await new Promise((resolve)=>setTimeout(resolve, 1000));
                        timeoutSeconds--;
                    }
                    await browser.close();
                    if (timeoutSeconds <= 0) return;
                    let database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)();
                    for(let i = 0; i < map.images.length; i++){
                        let image = uploaded_images.find((img)=>img.originalUrl === map.images[i]);
                        if (image) map.images[i] = image.transferredUrl;
                    }
                    await database.collection.updateOne({
                        slug: map.slug
                    }, {
                        $set: {
                            images: map.images
                        }
                    });
                } catch (e) {
                    (0, $ddaa8d734a279805$export$e033206476818195)("loadAndTransferImages", e);
                    console.log("Error loading page: " + e);
                }
            } catch (e) {
                (0, $ddaa8d734a279805$export$e033206476818195)("loadAndTransferImages", e);
                console.log("Error fetching images using puppeteer: " + e);
            }
        });
    } catch (e) {
        (0, $ddaa8d734a279805$export$e033206476818195)("loadAndTransferImages", e);
        console.log("Error launching puppeteer: " + e);
    }
}
async function $cfdaccb57129ec62$export$a5c22ef5cdb863ae(slug, collection) {
    let database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)("content", collection);
    return await database.collection.findOne({
        slug: slug
    }) === null;
}


function $974b68c5c8b688f6$export$50e60887d23d5928() {
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).post("/content", async (req, res)=>{
        if (!req.body.content) {
            res.send({
                error: "Content not included in request body"
            });
            return;
        }
        if (!req.body.content.title) {
            res.send({
                error: "Content does not appear to be formatted correctly, title is missing"
            });
            return;
        }
        if (!req.body.content.type) {
            res.send({
                error: "Content does not appear to be formatted correctly, type is missing"
            });
            return;
        }
        let uploader;
        if (req.headers.authorization) {
            console.log("Got authorization, attempting to find user");
            uploader = await (0, $1b14e0988bb761dd$export$56e97ac19e3a55d5)(req.headers.authorization);
            console.log("Got user from authorization");
        }
        switch(req.body.content.type){
            case "map":
                res.send(await (0, $cfdaccb57129ec62$export$b048f1436ab4c611)("Maps", req.body, uploader?.user));
                break;
            default:
                res.send({
                    error: "Content type not supported"
                });
                break;
        }
    });
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).post("/content/import", async (req, res)=>{
        let url = req.body.url;
        let token = req.body.token;
        if (!url) {
            res.send({
                error: "URL to import is missing"
            });
            return;
        }
        let map;
        if (url.startsWith("https://www.planetminecraft.com")) map = await (0, $cfdaccb57129ec62$export$18e125b1371a483)(url);
        else if (url.startsWith("https://www.minecraftmaps.com")) map = await (0, $cfdaccb57129ec62$export$b16f51c1b1e87afb)(url);
        else {
            res.send({
                error: "URL is not supported for importing"
            });
            return;
        }
        if (map) {
            if (token) {
                let user = await (0, $1b14e0988bb761dd$export$56e97ac19e3a55d5)(token);
                if (user.user) map.creators = [
                    {
                        username: user.user.username,
                        handle: user.user.handle
                    }
                ];
            }
            let i = "";
            let isSlugUnique = await (0, $cfdaccb57129ec62$export$a5c22ef5cdb863ae)(map.slu, "Maps");
            while(!isSlugUnique){
                i += (Math.random() * 100).toFixed(0);
                isSlugUnique = await (0, $cfdaccb57129ec62$export$a5c22ef5cdb863ae)(map.slug + i, "Maps");
            }
            map.slug = map.slug + i;
            let database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)();
            let result = await database.collection.insertOne(map);
            let key;
            if (!token) key = (0, $cpgow$jsonwebtoken).sign({
                _id: result.insertedId
            }, (0, $1b14e0988bb761dd$export$be15a7abd999b4ab), {
                expiresIn: "24h"
            });
            res.send({
                content: map.slug,
                key: key
            });
        } else res.send({
            error: "Map was not successfully imported"
        });
    });
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).post("/content/update", async (req, res)=>{
        let map = req.body.content;
        let database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)();
        let user = await (0, $1b14e0988bb761dd$export$56e97ac19e3a55d5)(req.headers.authorization + "");
        let currentMap = await database.collection.findOne({
            _id: new (0, $cpgow$ObjectId)(map._id)
        });
        if (!user.user || !currentMap || currentMap.creators?.filter((creator)=>creator.handle === user.user?.handle).length === 0 && user.user.type !== (0, $2d7f98b468ef9210$export$df06b7fc047181f5).Admin) {
            console.log("User not found or not creator");
            return res.sendStatus(401);
        }
        if (!map) {
            res.send({
                error: "Map not sent in request"
            });
            return;
        }
        let i = "";
        let isSlugUnique = await (0, $cfdaccb57129ec62$export$a5c22ef5cdb863ae)(map.slug, req.body.type) || map.slug === currentMap.slug;
        console.log("Checking if slug is unique: " + isSlugUnique, map.slug, currentMap.slug);
        while(!isSlugUnique){
            i += (Math.random() * 100).toFixed(0);
            isSlugUnique = await (0, $cfdaccb57129ec62$export$a5c22ef5cdb863ae)(map.slug + i, req.body.type);
        }
        map.slug = map.slug + i;
        let result = await database.collection.updateOne({
            _id: new (0, $cpgow$ObjectId)(map._id)
        }, {
            "$set": {
                title: map.title,
                shortDescription: map.shortDescription,
                description: map.description,
                images: map.images,
                status: map.status,
                downloads: map.downloads,
                slug: map.slug,
                createdDate: new Date(map.createdDate),
                updatedDate: req.body.dontUpdateDate ? new Date(map.updatedDate + "") : new Date(),
                creators: map.creators,
                files: map.files,
                tags: map.tags
            }
        });
        res.send({
            result: result
        });
    });
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).delete("/content", async (req, res)=>{
        let database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)();
        let user = await (0, $1b14e0988bb761dd$export$56e97ac19e3a55d5)(req.headers.authorization + "");
        let currentMap = await database.collection.findOne({
            _id: new (0, $cpgow$ObjectId)(req.body.id)
        });
        if (!user.user || !currentMap || currentMap.creators?.filter((creator)=>creator.handle === user.user?.handle).length === 0) {
            console.log("User not found or not creator");
            return res.sendStatus(401);
        }
        let result = await database.collection.deleteOne({
            _id: new (0, $cpgow$ObjectId)(req.body.id)
        });
        res.send({
            result: result
        });
    });
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).post("/content/request_approval", async (req, res)=>{
        let link = "https://next.mccreations.net/maps/" + req.body.slug;
        let database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)();
        let user = await (0, $1b14e0988bb761dd$export$56e97ac19e3a55d5)(req.headers.authorization + "");
        let map = await database.collection.findOne({
            slug: req.body.slug
        });
        if (!user.user || !map || map.creators?.filter((creator)=>creator.handle === user.user?.handle).length === 0) return res.sendStatus(401);
        (0, $3194f3505d176890$export$ff99bf209cf80629)(link);
        //https://discord.com/api/webhooks/1219390163105484860/pFfUP8gY7xP3OCkQpDSbcyPhZ5GbG485xl0Y3XrxRqpylSTiZ6S1PWVvXqjYEvzs3cFE
        await database.collection.updateOne({
            slug: req.body.slug
        }, {
            $set: {
                status: 1
            }
        });
        res.sendStatus(200);
        fetch("https://discord.com/api/webhooks/1219390163105484860/pFfUP8gY7xP3OCkQpDSbcyPhZ5GbG485xl0Y3XrxRqpylSTiZ6S1PWVvXqjYEvzs3cFE", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                content: "New Map Requesting Approval: " + link
            })
        }).then((response)=>{
            console.log(response);
        });
    });
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).get("/content/:slug/approve", async (req, res)=>{
        let database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)();
        let user = await (0, $1b14e0988bb761dd$export$56e97ac19e3a55d5)(req.headers.authorization + "");
        if (!user.user || user.user.type !== (0, $2d7f98b468ef9210$export$df06b7fc047181f5).Admin) return res.sendStatus(401);
        await database.collection.updateOne({
            slug: req.params.slug
        }, {
            $set: {
                status: 2
            }
        });
        res.sendStatus(200);
        let map = await database.collection.findOne({
            slug: req.params.slug
        });
        (0, $f9c6f11267aa3451$export$4b50f199f448c5e)();
        if (map) {
            let creators = map.creators;
            creators?.forEach(async (creator)=>{
                let creators = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)("content", "creators");
                let user = await creators.collection.findOne({
                    handle: creator.handle
                });
                if (user && user.email) (0, $3194f3505d176890$export$599d926730c0d987)(user.email, "https://next.mccreations.net/maps/" + req.params.slug, map?.title + "");
            });
            let discordMessage = {
                content: "<@&883788946327347210>",
                allowed_mentions: {
                    roles: [
                        "883788946327347210"
                    ]
                },
                embeds: [
                    {
                        title: map.title,
                        //   type: "rich",
                        description: map.shortDescription + " https://next.mccreations.net/maps/" + map.slug,
                        url: "https://next.mccreations.net/maps/" + map.slug,
                        //   timestamp: Date.now(),
                        //   color: 1,
                        image: {
                            url: map.images[0]
                        },
                        author: {
                            name: map.creators?.map((creator)=>creator.username).join(", ")
                        }
                    }
                ]
            };
            fetch("https://discord.com/api/webhooks/1020486876391559238/_efhzBaZTdt5IAHt3_YzBy2oOT5AYvoxg2Nr0lxMFaM3c6i8PYiuGXoOt_KZLHryZvLs", {
                method: "post",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(discordMessage)
            });
        }
    });
    (0, $e56ccaf93688c7b9$export$729c8b7179294ba).post("/content/rate/:slug", async (req, res)=>{
        let database = new (0, $8fd552124bedf3ec$export$6feb5ea51a7b0b47)();
        let map = req.body.map;
        // Calculate new rating
        let rating = 0;
        let ratings = map.ratings;
        let rates = 1;
        if (ratings) {
            rates = map.ratings.length + 1;
            ratings.push(Number.parseFloat(req.body.rating));
        } else ratings = [
            Number.parseFloat(req.body.rating)
        ];
        for(let i = 0; i < rates; i++)rating += ratings[i];
        rating = rating / (rates + 0.0);
        database.collection.updateOne({
            slug: req.params.slug
        }, {
            $set: {
                ratings: ratings,
                rating: rating
            }
        }).then(()=>{
            res.send({
                rating: rating
            });
        });
    });
}



const $e56ccaf93688c7b9$export$729c8b7179294ba = (0, $cpgow$express)();
$e56ccaf93688c7b9$export$729c8b7179294ba.use((0, $cpgow$helmet)());
$e56ccaf93688c7b9$export$729c8b7179294ba.use((0, $cpgow$bodyparser).json());
$e56ccaf93688c7b9$export$729c8b7179294ba.use((0, $cpgow$cors)());
$e56ccaf93688c7b9$export$729c8b7179294ba.use((0, $cpgow$morgan)("combined"));
const $e56ccaf93688c7b9$export$388e0302ca0d9a41 = new (0, $cpgow$MongoClient)("mongodb+srv://app-test:%40pp-t$st@mccreations.454k0cx.mongodb.net/?retryWrites=true&w=majority&appName=mccreations");
/**
 * Routes are broken up into separate files based on the 'section' of the site they are for.
 * Even though all content routes live in the same content folder they each have their own initialization function.
 */ (0, $ec8c082ad9cfa5c4$export$5cca2fc2d392520c)();
(0, $d528be0e4428fb13$export$546c0cedea069764)();
(0, $1b14e0988bb761dd$export$91166d83cfa6717d)();
(0, $974b68c5c8b688f6$export$50e60887d23d5928)();
setInterval((0, $f9c6f11267aa3451$export$4b50f199f448c5e), 86400000);
setInterval((0, $1b14e0988bb761dd$export$8fb3ef6296d15f5), 1296000000);
var $e56ccaf93688c7b9$var$httpServer = (0, $cpgow$createServer)($e56ccaf93688c7b9$export$729c8b7179294ba);
$e56ccaf93688c7b9$var$httpServer.listen(8080);


export {$e56ccaf93688c7b9$export$729c8b7179294ba as app, $e56ccaf93688c7b9$export$388e0302ca0d9a41 as client};
//# sourceMappingURL=index.js.map
