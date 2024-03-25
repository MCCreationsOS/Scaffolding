import axios from "axios";
import { Database } from "../db/connect.js";
import { IInlineCreator, MapDoc } from "../db/types.js";
import { app } from "../index.js";
import { JSDOM } from 'jsdom'
import jwt from 'jsonwebtoken'
import { JWTKey, getUserFromJWT } from "../auth/routes.js";
import s3 from "aws-sdk";
import { Readable } from "stream";
import { ObjectId } from "mongodb";
import { findMaps } from "../maps/routes.js";
import { approvedEmail, requestApprovalEmail } from "../email/email.js";
import puppeteer from "puppeteer";
const { S3 } = s3

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

        let slug = req.body.content.title.toLowerCase().replace(/\s/g, "_").replace(/[^a-zA-Z0-9_]/g, "")
        console.log("Slug: " + slug)
        let i = "";
        let isSlugUnique = await checkIfSlugUnique(slug)
        while(!isSlugUnique) {
            i += (Math.random() * 100).toFixed(0);
            isSlugUnique = await checkIfSlugUnique(slug + i)
        }
        slug = slug + i;

        let database = new Database();
        if(req.body.content.type === "Map") {
            let map: MapDoc = {
                title: req.body.content.title as string,
                shortDescription: req.body.content.summary as string,
                description: "",
                images: [],
                status: 0,
                downloads: 0,
                views: 0,
                slug: slug,
                rating: 0,
                createdDate: new Date(Date.now())
            }
            console.log("Attempting to insert map")
            let result = await database.collection.insertOne(map);
            console.log("Map inserted")

            if(uploader && uploader.user) {
                database.collection.updateOne({_id: result.insertedId}, {$push: {creators: {username: uploader.user.username, handle: uploader.user.handle}}})
                res.send({slug: map.slug})
                return;
            } else {
                console.log("No user, creating temporary access key")
                let key = jwt.sign({_id: result.insertedId.toJSON()}, JWTKey, {expiresIn: "24h"})
                res.send({key: key, slug: map.slug})
                return;
            }
        }
        res.sendStatus(200)
    })

    app.post("/content/import", async (req, res) => {
        let url = req.body.url;
        let token = req.body.token;
        if(!url){
            res.send({error: "URL to import is missing"})
            return;
        }

        let map: MapDoc | undefined;

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
            let isSlugUnique = await checkIfSlugUnique(map.slug)
            while(!isSlugUnique) {
                i += (Math.random() * 100).toFixed(0);
                isSlugUnique = await checkIfSlugUnique(map.slug + i)
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
        let map = req.body.content as MapDoc
        let database = new Database();
        let user = await getUserFromJWT(req.headers.authorization + "")
        let currentMap = await database.collection.findOne<MapDoc>({_id: new ObjectId(map._id)})

        if(!user.user || !currentMap || currentMap.creators?.filter(creator => creator.handle === user.user?.handle).length === 0) { 
            console.log("User not found or not creator")
            return res.sendStatus(401);
        }

        if(!map) {
            res.send({error: "Map not sent in request"})
            return;
        }

        let i = "";
        let isSlugUnique = (await checkIfSlugUnique(map.slug)) && map.slug !== currentMap.slug
        while(!isSlugUnique) {
            i += (Math.random() * 100).toFixed(0);
            isSlugUnique = await checkIfSlugUnique(map.slug + i)
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
                updatedDate: new Date(),
                creators: map.creators,
                files: map.files
            }
        })
        res.send({result: result})
    })

    app.delete('/content', async (req, res) => {
        let database = new Database();
        let user = await getUserFromJWT(req.headers.authorization + "")
        let currentMap = await database.collection.findOne<MapDoc>({_id: new ObjectId(req.body.id)})

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
        let map = await database.collection.findOne<MapDoc>({slug: req.body.slug})

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
        if(!user.user || user.user.handle !== "crazycowmm") {
            return res.sendStatus(401);
        }
        await database.collection.updateOne({slug: req.params.slug}, {$set: {status: 2}})
        res.sendStatus(200)

        let map = await database.collection.findOne<MapDoc>({slug: req.params.slug})
        if(map) {
            let creators = map.creators
            creators?.forEach(async (creator) => {
                let user = await database.collection.findOne({handle: creator.handle})
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

const bucket = new S3({
    region: 'us-west-1',
    accessKeyId: "***REMOVED***",
    secretAccessKey: "***REMOVED***"
});

async function upload(file: string | Readable | Buffer | Uint8Array | Blob, name: string): Promise<string | any> {
    const params = {
        Bucket: 'mccreations',
        Key: name,
        Body: file
    }
    try {
        const u = bucket.upload(params);
        let data = await u.promise()
        console.log("Uploaded " + name);
        return data.Location
    } catch (error) {
        return error;
    }
}

async function fetchFromPMC(url: string) {
    let res = await axios.get(url)
    let html = new JSDOM(res.data).window.document

    
    let title = html.querySelector('div#resource-title-text h1')?.textContent?.trim();
    if(!title) return;
    let slug = title.toLowerCase().replace(/\s/g, "_").replace(/[^a-zA-Z0-9_]/g, "")
    let description = html.querySelector('#r-text-block')?.innerHTML
    if(!description) return;
    let shortDescription = ''
    let status = 0
    let downloads = 0;
    let views = 0;
    let rating = 0;
    let createdDate = new Date();
    let users = html.querySelectorAll('.pusername')
    let username = ""
    if(users.length === 1) {
        username = html.querySelectorAll('.pusername')[0].textContent + ""
    } else {
        username = html.querySelectorAll('.pusername')[1].textContent + ""
    }

    let map: MapDoc = {
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
        creators: [{username: username}],
        importedUrl: url
    }

    map.files = [{type: 'world', worldUrl: "https://www.planetminecraft.com" + html.querySelector('.branded-download')?.getAttribute('href'), minecraftVersion: ''}]
    let images = html.querySelectorAll('.rsImg')
    images.forEach(async (image, idx) => {
        let url = image.getAttribute('href')!
        try {
            let response = await axios.get(url);
            let buffer = await response.data;
            upload(new Uint8Array(buffer), `${map.slug}_image_${idx}${url.substring(url.lastIndexOf('.'))}`);
            map.images.push(`https://mccreations.s3.us-west-1.amazonaws.com/${map.slug}_image_${idx}${url.substring(url.lastIndexOf('.'))}`)
        } catch(e) {
            map.images.push(url)
        }
    })

    // await loadAndTransferImages(map)
    return map;
}

async function fetchFromMCMaps(url: string) {
    const mapInfoLocator = 'Map Info</h2>\n</center></td>\n</tr>\n</tbody>\n</table>'
    const pictureLocator = '<table style="width: 100%;" border="0" cellspacing="0" cellpadding="0">\n<tbody>\n<tr>\n<td class="info_title"><center>\n<h2>Pictures</h2>\n</center></td>\n</tr>\n</tbody>\n</table>'
    const changelogLocator = '<table border="0" width="98%" cellspacing="0" cellpadding="0">\n<tbody>\n<tr>\n<td class="info_title">\n<h2><center>Changelog</center></h2>\n</td>\n</tr>\n</tbody>\n</table>'
    let res = await axios.get(url)
    let html = new JSDOM(res.data).window.document

    let descTable = html.querySelector('table')?.querySelector('table')?.querySelector('td')?.innerHTML
    let statsPanel = html.querySelector('div.stats_data')?.querySelectorAll('table')[1]
    if(!descTable) return;
    let mapInfoStart = descTable.indexOf(mapInfoLocator)
    let pictureStart = descTable.indexOf(pictureLocator)
    let changelogStart = descTable.indexOf(changelogLocator)

    let title = html.querySelector('h1')?.textContent?.trim();
    if(!title) return;
    let slug = title.toLowerCase().replace(/\s/g, "_").replace(/[^a-zA-Z0-9_]/g, "")
    let description = ""
    if(descTable.includes(pictureLocator)) {
        description = descTable.substring(mapInfoStart + mapInfoLocator.length, pictureStart)
    } else {
        description = descTable.substring(mapInfoStart + mapInfoLocator.length, changelogStart)
    }
    description.replace(/\<table style="width: 98%;" border="0" cellspacing="0" cellpadding="0"\>\n\<tbody\>\n\<tr>\n\<td class="info_title"><center>/g, "")
    description.replace(/\<\/center\>\<\/td\>\n\<\/tr\>\n\<\/tbody\>\n\<\/table>/g, "")
    let shortDescription = ''
    let status = 0
    let downloads = 0;
    let views = 0;
    let rating = 0;
    let createdDate = new Date();
    let username = statsPanel?.querySelectorAll('tr')[0].querySelectorAll('span')[1].textContent + ""

    let map: MapDoc = {
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
        creators: [{username: username}],
        importedUrl: url
    }

    map.files = [{
        type: 'world', 
        worldUrl: "https://minecraftmaps.com" + html.querySelector('.jdbutton')?.getAttribute('href'), 
        minecraftVersion: statsPanel?.querySelectorAll('tr')[3].querySelectorAll('span')[1].textContent + "", 
        contentVersion: statsPanel?.querySelectorAll('tr')[2].querySelectorAll('span')[1].textContent + ""}]

    let images = html.querySelector('table')?.querySelector('table')?.querySelector('td')?.querySelectorAll('img')

    map.images.push(html.querySelector('.map-images')?.getAttribute('src')!)
    if(images) {
        images.forEach(async (image, idx) => {
            let url = image.getAttribute('data-src')!
            // try {
            //     let response = await axios.get(url);
            //     let buffer = await response.data;
            //     upload(new Uint8Array(buffer), `${map.slug}_image_${idx}${url.substring(url.lastIndexOf('.'))}`);
            //     map.images.push(`https://mccreations.s3.us-west-1.amazonaws.com/${map.slug}_image_${idx}${url.substring(url.lastIndexOf('.'))}`)
            // } catch(e) {
                map.images.push(url)
            // }
        })
    }
    // await loadAndTransferImages(map)
    return map;
}

interface TransferredImage {
    originalUrl: string,
    transferredUrl: string
}

async function loadAndTransferImages(map: MapDoc) {
    try {
        puppeteer.launch().then(async browser => {
            try {
                let idx = 0;
                let fileCounter = 0;
                let uploaded_images: TransferredImage[] = []
                let timeoutSeconds = 30;
                const page = await browser.newPage();
            
                page.on('response', async (response) => {
                    try {
                        const matches = /.*\.(jpg|png|svg|gif|webp)$/.exec(response.url());
                        if (matches && (matches.length === 2) && (response.url().startsWith('https://www.minecraftmaps.com/images/jdownloads/screenshots/') || response.url().startsWith("https://static.planetminecraft.com/files/image/minecraft/"))) {
                            console.log(matches);
                            const extension = matches[1];
                            const buffer = await response.buffer();
                            fileCounter += 1;
                            let url = await upload(buffer, `${map.slug}_image_${fileCounter}.${extension}`)
                            uploaded_images.push({transferredUrl: url, originalUrl: response.url()})
                        }
                    } catch(e) {
                        console.log("Error uploading image: " + e)
                    }
                  });
                
                await page.goto(map.importedUrl!);
                try {
                    // page.mouse.wheel({deltaY: 2000})
    
                    while(uploaded_images.length < map.images.length && timeoutSeconds > 0) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        timeoutSeconds--;
                    }
                    await browser.close();
    
                    if(timeoutSeconds <= 0) {
                        return;
                    }
                    
                    let database = new Database();
                    for(let i = 0; i < map.images.length; i++) {
                        let image = uploaded_images.find(img => img.originalUrl === map.images[i])
                        if(image) {
                            map.images[i] = image.transferredUrl
                        }
                    }
                    await database.collection.updateOne({slug: map.slug}, {$set: {images: map.images}})
                } catch(e) {
                    console.log("Error loading page: " + e)
                
                }
            } catch(e) {
                console.log("Error fetching images using puppeteer: " + e)
            }
        })
    } catch(e) {
        console.log("Error launching puppeteer: " + e)
    }
}

export async function checkIfSlugUnique(slug: string) {
    let database = new Database();
    return (await database.collection.findOne({slug: slug})) === null
}