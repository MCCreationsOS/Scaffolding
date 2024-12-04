import { ObjectId } from "mongodb";
import jwt from 'jsonwebtoken'

import { Database } from "../db/connect.js";
import { ContentDocument, DatabaseCollection, LeaderboardFeature, SearchIndex } from "../db/types.js";
import { app } from "../index.js";
import { JWTKey, getIdFromJWT, getUserFromJWT } from "../auth/routes.js";
import { approvedEmail, requestApprovalEmail } from "../email/email.js";
import { updateMeilisearch } from "../meilisearch.js";
import { User, UserTypes } from "../auth/types.js";
import { checkIfSlugUnique, fetchFromMCMaps, fetchFromModrinth, fetchFromPMC, uploadContent } from "./creation.js";
import { findContent, getFeed, performSearch } from "./searching.js";
import { Readable } from "stream";
import path from "path";
import { generateSubmissionFunctions } from "../extraFeatures/leaderboards.js";
import simpleGit from "simple-git";
import { upload } from "../s3/upload.js";
import { createWriteStream, mkdirSync, unlinkSync, writeFile, writeFileSync } from "fs";
import { readdir, readFile, rm } from "fs/promises";
import archiver from "archiver";
import {open} from "yauzl";
import { injectLeaderboards } from "./injecting/leaderboards.js";
import { postNewCreation } from "../../discord_bot/index.js";
import { createNotificationsForSubscribers, createNotificationToCreators } from "../notifications/index.js";

export function initializeContentRoutes() {
    app.get('/content', async (req, res) => {
        let result = await performSearch(req.query)
		let user = await getUserFromJWT(req.headers.authorization + "")

		result.documents = result.documents.filter((map: ContentDocument) => {
			if(map.status < 1) {
				if(user.user && (map.creators)) {
					for(const creator of map.creators) {
						if(creator.handle === user.user.handle) return true;
					}
				} else if(user.user && map.owner && map.owner === user.user.handle) {
                    return true;
                } else {
					let id = getIdFromJWT(req.headers.authorization + "") as ObjectId
					if(id && id instanceof ObjectId && id.equals(map._id)) {
						return true;
					}
				}
				return false;
			}
			return true;
		})

        if(req.query.sendCount && req.query.sendCount === "true") {
            res.send({count: result.totalCount})
        } else {
            res.send(result);
        }
    })

    app.get('/content-nosearch', async (req, res) => {
        let type = req.query.contentType || "Maps";
        let result
        if(type === "content") {
            result = await findContent(DatabaseCollection.Maps, req.query, false)
            let result2 = await findContent(DatabaseCollection.Resourcepacks, req.query, false)
            let result3 = await findContent(DatabaseCollection.Datapacks, req.query, false)
            result.documents = result.documents.concat(result2.documents).concat(result3.documents)
            result.documents = result.documents.sort((a, b) => {
                if(a.createdDate > b.createdDate) {
                    return -1
                } else {
                    return 1
                }
            })
            result.documents.length = parseInt(req.query.limit as string) || 20
        } else {
            result = await findContent(type as DatabaseCollection, req.query, false)
        }
        let user = await getUserFromJWT(req.headers.authorization + "")

		result.documents = result.documents.filter((map: ContentDocument) => {
			if(map.status < 2) {
				if(user.user && map.creators) {
					if(user.user.type === UserTypes.Admin) return true;
					for(const creator of map.creators) {
						if(creator.handle === user.user.handle) return true;
					}
				} else if(user.user && map.owner && map.owner === user.user.handle) {
                    return true;
                } else {
					let id = getIdFromJWT(req.headers.authorization + "") as ObjectId
					if(id && id instanceof ObjectId && id.equals(map._id)) {
						return true;
					}
				}
				return false;
			}
			return true;
		})

        if(req.query.sendCount && req.query.sendCount === "true") {
            res.send({count: result.totalCount})
        } else {
            res.send(result);
        }
    })

    app.get('/content/feed', async (req, res) => {
        let user = await getUserFromJWT(req.headers.authorization + "")
        if(!user.user) {
            res.sendStatus(401)
            return;
        }
        let page = parseInt(req.query.page as string) || 0
        let limit = parseInt(req.query.limit as string) || 20
        res.send(await getFeed(user.user, limit, page))
    })

    app.post('/content', async (req, res) => {
        if(!req.body.content) {
            res.send({error: "Content not included in request body"})
            return;
        }
        if(!req.body.content.title) {
            res.send({error: "Content does not appear to be formatted correctly, title is missing"})
            return;
        }
        if(!req.body.content.type) {
            res.send({error: "Content does not appear to be formatted correctly, type is missing"})
            return;
        }
        let uploader;
        if(req.headers.authorization) {
            console.log("Got authorization, attempting to find user")
            uploader = await getUserFromJWT(req.headers.authorization);
            console.log("Got user from authorization")
        }

        switch(req.body.content.type) {
            case "map":
                res.send(await uploadContent(DatabaseCollection.Maps, req.body, uploader?.user))
                break;
            case 'datapack':
                res.send(await uploadContent(DatabaseCollection.Datapacks, req.body, uploader?.user))
                break;
            case 'resourcepack':
                res.send(await uploadContent(DatabaseCollection.Resourcepacks, req.body, uploader?.user))
                break;
            default:
                res.send({error: "Content type not supported"})
                break;
        }
    })

    app.post("/content/import", async (req, res) => {
        let url = req.body.url;
        let token = req.body.token;
        if(!url){
            res.send({error: "URL to import is missing"})
            return;
        }

        let map: ContentDocument | undefined;

        if(url.startsWith('https://www.planetminecraft.com')) {
            map = await fetchFromPMC(url, req.body.type);
        } else if(url.startsWith('https://www.minecraftmaps.com')) {
            map = await fetchFromMCMaps(url);
        } else if (url.startsWith('https://modrinth.com')) {
            map = await fetchFromModrinth(url, req.body.type);
        } else {
            res.send({error: "URL is not supported for importing"})
            return;
        }

        if(map) {
            if(token) {
                let user = await getUserFromJWT(token)
                if(user.user) {
                    map.creators = [{username: user.user.username, handle: user.user.handle}]
                    map.owner = user.user.handle;
                }
            }

            let i = "";
            let isSlugUnique = await checkIfSlugUnique(map.slug, req.body.type)
            while(!isSlugUnique) {
                i += (Math.random() * 100).toFixed(0);
                isSlugUnique = await checkIfSlugUnique(map.slug + i, req.body.type)
            }
            map.slug = map.slug + i;

            map.type = req.body.type.toLowerCase().substring(0, req.body.type.length - 1);

            let database = new Database("content", req.body.type);
            let result = await database.collection.insertOne(map);
            if(!result.acknowledged) {
                res.send({error: "Map was not successfully imported"})
                return;
            }
            let key
            if(!token) {
                key = jwt.sign({_id: result.insertedId}, JWTKey, {expiresIn: "24h"})
            }
            res.send({content: map.slug, key: key});
        } else {
            res.send({error: "Map was not successfully imported, request was probably blocked."})
        }
    })

    app.post('/content/update', async (req, res) => {
        let map = req.body.content as ContentDocument
        console.log(req.body.type)
        let database = new Database("content", req.body.type);
        let user = await getUserFromJWT(req.headers.authorization + "")
        let currentMap = await database.collection.findOne({_id: new ObjectId(map._id)})

        if(!user.user) {
            let key = getIdFromJWT(req.headers.authorization + "")
            if(!key) {
                return res.status(401).send({error: "User not found"});
            } else if(key instanceof ObjectId && key.equals(currentMap?._id)) {

            } else {
                return res.sendStatus(401);
            }
        }

        if(!currentMap) {
            console.log(currentMap)
            res.send({error: "Map not found"})
            return;
        }

        if((currentMap.creators?.filter(creator => creator.handle === user.user?.handle).length === 0 && user.user?.type !== UserTypes.Admin && currentMap.owner !== user.user?.handle)) { 
            console.log("User not found or not creator")
            let id = await getIdFromJWT(req.headers.authorization + "")
            if(id && id instanceof ObjectId && id.equals(currentMap?._id)) {

            } else {
                return res.sendStatus(401);
            }
        }

        if(!map) {
            res.send({error: "Map not sent in request"})
            return;
        }

        let i = "";
        let isSlugUnique = (await checkIfSlugUnique(map.slug, req.body.type)) || map.slug === currentMap?.slug
        console.log("Checking if slug is unique: " + isSlugUnique, map.slug, currentMap?.slug)
        while(!isSlugUnique) {
            i += (Math.random() * 100).toFixed(0);
            isSlugUnique = await checkIfSlugUnique(map.slug + i, req.body.type)
        }
        map.slug = map.slug + i;
        
        let result = await database.collection.updateOne({_id: new ObjectId(map._id)}, {
            "$set": {
                title: map.title,
                shortDescription: map.shortDescription,
                description: map.description,
                images: map.images,
                status: map.status,
                downloads: map.downloads,
                slug: map.slug,
                createdDate: new Date(map.createdDate),
                updatedDate: (req.body.dontUpdateDate) ? new Date(map.updatedDate + "") : new Date(),
                creators: map.creators,
                files: map.files,
                tags: map.tags,
                videoUrl: map.videoUrl,
                extraFeatures: map.extraFeatures,
            }
        })


        let leaderboardFeature = map.extraFeatures?.leaderboards as LeaderboardFeature | undefined
        if(leaderboardFeature && leaderboardFeature.use && (currentMap.extraFeatures !== map.extraFeatures || currentMap.files !== map.files)) {
            if(leaderboardFeature.message && leaderboardFeature.message !== "" && map.files && map.files[0].url) {
                injectLeaderboards(map.files[0].url, map.slug, map.type, leaderboardFeature.message, leaderboardFeature.messageFormatting).then((url) => {
                    map.files![0].url = url;
                    database.collection.updateOne({_id: new ObjectId(map._id)}, {
                        "$set": {
                            files: map.files,
                            extraFeatures: map.extraFeatures
                        }
                    })
                }).catch((e) => {
                    console.log(e)
                })
            }
        }

        if(map.status === 2) {
            updateMeilisearch();
        }


        res.send({result: result})
    })

    app.post('/content/update_translation', async (req, res) => {
        let slug = req.body.slug;
        let translation = req.body.translation;
        let database = new Database('content', req.body.type);
        let user = await getUserFromJWT(req.headers.authorization + "")
        let key = Object.keys(translation)[0]
        if(user.user) {
            translation[key].author = user.user.handle;
        }
        if(translation[key].approved === undefined) translation[key].approved = false;
        translation[key].date = new Date();
        console.log(translation)
        let cursor = await database.collection.aggregate<ContentDocument>([
            {
              '$match': {
                'slug': slug
              }
            }, {
              '$set': {
                'translations': {
                  '$mergeObjects': [
                    '$translations', translation
                  ]
                }
              }
            }
          ])
          let updated = await cursor.toArray();
        database.collection.updateOne({slug: slug}, {$set: updated[0]})
        res.send({result: updated})

        if(user.user && user.user.handle !== updated[0].owner) {
            createNotificationToCreators({
                content: updated[0],
                type: req.body.type,
                title: {key: "Account.Notifications.NewTranslation.title"},
                body: {key: "Account.Notifications.NewTranslation.body", options: {type: req.body.type, username: user.user?.username, language: key}}
            })
        }
    })

    app.delete('/content', async (req, res) => {
        let database = new Database("content", req.body.type);
        let user = await getUserFromJWT(req.headers.authorization + "")
        let currentMap = await database.collection.findOne({_id: new ObjectId(req.body.id)})

        if(!user.user || !currentMap || (currentMap.creators?.filter(creator => creator.handle === user.user?.handle).length === 0 && user.user.type !== UserTypes.Admin && currentMap.owner !== user.user.handle)) { 
            console.log("User not found or not creator")
            return res.sendStatus(401);
        }

        let result = await database.collection.deleteOne({_id: new ObjectId(req.body.id)})
        res.send({result: result})
    })

    app.post('/content/request_approval', async (req, res) => {
        let link = `https://mccreations.net/${req.body.type.toLowerCase()}/${req.body.slug}`
        let type = req.body.type || "Maps";
        let database = new Database("content", type);
        let user = await getUserFromJWT(req.headers.authorization + "")
        let map = await database.collection.findOne({slug: req.body.slug})

        if(!user.user || !map || (map.creators?.filter(creator => creator.handle === user.user?.handle).length === 0 && user.user.type !== UserTypes.Admin && map.owner !== user.user.handle)) { 
            return res.sendStatus(401);
        }
        // requestApprovalEmail(link)
    
        await database.collection.updateOne({slug: req.body.slug}, {$set: {status: 1}})
        res.sendStatus(200)

        fetch(process.env.DISCORD_UPDATE_WEBHOOK_URL + "", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: `New ${type} Requesting Approval: ${link}`
            })
        
        })

        map.creators?.forEach(async (creator) => {
            let creators = new Database('content', 'creators')
            let user = await creators.collection.findOne<User>({handle: creator.handle})
            if(user) {
                createNotificationsForSubscribers({
                    user: user,
                    link: link,
                    title: {key: "Account.Notifications.NewPost.title"},
                    body: {key: "Account.Notifications.NewPost.body", options: {type: type, username: creator.handle}}
                })
            }
        })
    })

    app.get('/content/:slug/approve', async (req, res) => {
        let type = req.query.contentType as string || "Maps";
        let database = new Database<ContentDocument>("content", type);
        let user = await getUserFromJWT(req.headers.authorization + "")
        if(!user.user || user.user.type !== UserTypes.Admin) {
            return res.sendStatus(401);
        }
        await database.collection.updateOne({slug: req.params.slug}, {$set: {status: 2, createdDate: new Date()}})
        res.sendStatus(200)

        let map = await database.collection.findOne({slug: req.params.slug})
        updateMeilisearch();
        if(map) {
            let creators = map.creators
            creators?.forEach(async (creator) => {
                let creators = new Database('content', 'creators')
                let user = await creators.collection.findOne({handle: creator.handle})
                if(user && user.email) {
                    approvedEmail(user.email, `https://mccreations.net/${type.toLowerCase()}/${map.slug}`, map?.title + "")
                }
            })

            postNewCreation(map, "<@&883788946327347210>")
        }
    })

    app.post('/content/rate/:slug', async (req, res) => {
        let database = new Database<ContentDocument>();
        let map = req.body.map
        switch(map.type) {
            case "datapack":
                database = new Database<ContentDocument>("content", "datapacks")
                break;
            case "resourcepack":
                database = new Database<ContentDocument>("content", "resourcepacks")
                break;
        }
	
        // Calculate new rating
        let rating = 0;
        let ratings = map.ratings;
        let rates = 1;
        if(ratings) {
            rates = map.ratings.length + 1;
            ratings.push(Number.parseFloat(req.body.rating))
        } else {
            ratings = [Number.parseFloat(req.body.rating)]
        }

        for(let i = 0; i < rates; i++) {
            rating += ratings[i];
        }
        rating = rating/(rates + 0.0);

        database.collection.updateOne({slug: req.params.slug}, {$set: {ratings: ratings, rating: rating}}).then(() => {
            res.send({rating: rating})
        })

        createNotificationToCreators({
            content: map,
            type: map.type,
            title: {key: "Account.Notifications.NewRating.title"},
            body: {key: "Account.Notifications.NewRating.body", options: {rating: rating, title: map.title}}
        })
    })
}