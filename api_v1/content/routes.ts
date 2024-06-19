import { ObjectId } from "mongodb";
import jwt from 'jsonwebtoken'

import { Database } from "../db/connect.js";
import { ContentDocument } from "../db/types.js";
import { app } from "../index.js";
import { JWTKey, getUserFromJWT } from "../auth/routes.js";
import { approvedEmail, requestApprovalEmail } from "../email/email.js";
import { updateMeilisearch } from "../meilisearch.js";
import { UserTypes } from "../auth/types.js";
import { checkIfSlugUnique, fetchFromMCMaps, fetchFromPMC, uploadContent } from "./creation.js";

export function initializeContentRoutes() {
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
                res.send(await uploadContent("Maps", req.body, uploader?.user))
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
            map = await fetchFromPMC(url);
        } else if(url.startsWith('https://www.minecraftmaps.com')) {
            map = await fetchFromMCMaps(url);
        } else {
            res.send({error: "URL is not supported for importing"})
            return;
        }

        if(map) {
            if(token) {
                let user = await getUserFromJWT(token)
                if(user.user) {
                    map.creators = [{username: user.user.username, handle: user.user.handle}]
                }
            }

            let i = "";
            let isSlugUnique = await checkIfSlugUnique(map.slu, "Maps")
            while(!isSlugUnique) {
                i += (Math.random() * 100).toFixed(0);
                isSlugUnique = await checkIfSlugUnique(map.slug + i, "Maps")
            }
            map.slug = map.slug + i;

            let database = new Database();
            let result = await database.collection.insertOne(map);
            let key
            if(!token) {
                key = jwt.sign({_id: result.insertedId}, JWTKey, {expiresIn: "24h"})
            }
            res.send({content: map.slug, key: key});
        } else {
            res.send({error: "Map was not successfully imported"})
        }
    })

    app.post('/content/update', async (req, res) => {
        let map = req.body.content as ContentDocument
        let database = new Database();
        let user = await getUserFromJWT(req.headers.authorization + "")
        let currentMap = await database.collection.findOne<ContentDocument>({_id: new ObjectId(map._id)})

        if(!user.user || !currentMap || (currentMap.creators?.filter(creator => creator.handle === user.user?.handle).length === 0 && user.user.type !== UserTypes.Admin)) { 
            console.log("User not found or not creator")
            return res.sendStatus(401);
        }

        if(!map) {
            res.send({error: "Map not sent in request"})
            return;
        }

        let i = "";
        let isSlugUnique = (await checkIfSlugUnique(map.slug, req.body.type)) || map.slug === currentMap.slug
        console.log("Checking if slug is unique: " + isSlugUnique, map.slug, currentMap.slug)
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
            }
        })
        res.send({result: result})
    })

    app.delete('/content', async (req, res) => {
        let database = new Database();
        let user = await getUserFromJWT(req.headers.authorization + "")
        let currentMap = await database.collection.findOne<ContentDocument>({_id: new ObjectId(req.body.id)})

        if(!user.user || !currentMap || currentMap.creators?.filter(creator => creator.handle === user.user?.handle).length === 0) { 
            console.log("User not found or not creator")
            return res.sendStatus(401);
        }

        let result = await database.collection.deleteOne({_id: new ObjectId(req.body.id)})
        res.send({result: result})
    })

    app.post('/content/request_approval', async (req, res) => {
        let link = "https://next.mccreations.net/maps/" + req.body.slug
        let database = new Database();
        let user = await getUserFromJWT(req.headers.authorization + "")
        let map = await database.collection.findOne<ContentDocument>({slug: req.body.slug})

        if(!user.user || !map || map.creators?.filter(creator => creator.handle === user.user?.handle).length === 0) { 
            return res.sendStatus(401);
        }
        requestApprovalEmail(link)

        //***REMOVED***
    
        await database.collection.updateOne({slug: req.body.slug}, {$set: {status: 1}})
        res.sendStatus(200)

        fetch('***REMOVED***', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: "New Map Requesting Approval: " + link
            })
        
        }).then(response => {
            console.log(response)
        })
    })

    app.get('/content/:slug/approve', async (req, res) => {
        let database = new Database();
        let user = await getUserFromJWT(req.headers.authorization + "")
        if(!user.user || user.user.type !== UserTypes.Admin) {
            return res.sendStatus(401);
        }
        await database.collection.updateOne({slug: req.params.slug}, {$set: {status: 2}})
        res.sendStatus(200)

        let map = await database.collection.findOne<ContentDocument>({slug: req.params.slug})
        updateMeilisearch();
        if(map) {
            let creators = map.creators
            creators?.forEach(async (creator) => {
                let creators = new Database('content', 'creators')
                let user = await creators.collection.findOne({handle: creator.handle})
                if(user && user.email) {
                    approvedEmail(user.email, "https://next.mccreations.net/maps/" + req.params.slug, map?.title + "")
                }
            })

            let discordMessage = {
                content: "<@&883788946327347210>",
                allowed_mentions:{
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
                            name: map.creators?.map(creator => creator.username).join(", ")
                        }
                    }
                ]
            }

            fetch("***REMOVED***", {
                method: 'post',
                headers: {
                "Content-Type": "application/json"
                },
                body: JSON.stringify(discordMessage)
            });
        }
    })

    app.post('/content/rate/:slug', async (req, res) => {
        let database = new Database();
        let map = req.body.map
	
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
    })
}