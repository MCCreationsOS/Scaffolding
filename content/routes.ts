import axios from "axios";
import { Database } from "../db/connect.js";
import { MapDoc } from "../db/types.js";
import { app } from "../index.js";
import { JSDOM } from 'jsdom'
import jwt from 'jsonwebtoken'
import { JWTKey, getUserFromJWT } from "../auth/routes.js";
import s3 from "aws-sdk";
import { Readable } from "stream";
import { ObjectId } from "mongodb";
import { findMaps } from "../maps/routes.js";
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
            uploader = await getUserFromJWT(req.headers.authorization);
        }
        let database = new Database();
        if(req.body.content.type === "Map") {
            let map: MapDoc = {
                title: req.body.content.title as string,
                shortDescription: req.body.content.shortDescription as string,
                description: "",
                images: [],
                status: 0,
                downloads: 0,
                views: 0,
                slug: req.body.content.title.toLowerCase().replace(/\s/g, "_"),
                rating: 0,
                createdDate: new Date(Date.now())
            }

            let result = await database.collection.insertOne(map);

            if(uploader && uploader.user) {
                database.collection.updateOne({_id: result.insertedId}, {$push: {creators: {username: uploader.user.username, handle: uploader.user.handle}}})
                res.send({slug: map.slug})
                return;
            } else {
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

        if(!map) {
            res.send({error: "Map not sent in request"})
            return;
        }
        let database = new Database();
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
                creators: map.creators
            }
        })
        res.send({result: result})
    })
}

const bucket = new S3({
    region: 'us-west-1',
    accessKeyId: "***REMOVED***",
    secretAccessKey: "***REMOVED***"
});

async function upload(file: string | Readable | Buffer | Uint8Array | Blob, name: string) {
    const params = {
        Bucket: 'mccreations',
        Key: name,
        Body: file
    }
    try {
        const u = bucket.upload(params);
        await u.promise().catch(error => {
            console.error(error)
        });
        console.log("Uploaded " + name);
    } catch (error) {
        return error;
    }
}

async function fetchFromPMC(url: string) {
    let res = await axios.get(url)
    let html = new JSDOM(res.data).window.document

    
    let title = html.querySelector('h1#resource-title-text')?.textContent?.trim();
    if(!title) return;
    let slug = title.toLowerCase().replace(/\s/g, "_")
    let description = html.querySelector('#r-text-block')?.innerHTML
    if(!description) return;
    let shortDescription = ''
    let status = 0
    let downloads = 0;
    let views = 0;
    let rating = 0;
    let createdDate = new Date();
    let username = html.querySelectorAll('.pusername')[1].textContent + ""

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
        creators: [{username: username}]
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
    let slug = title.toLowerCase().replace(/\s/g, "_")
    let description = descTable.substring(mapInfoStart + mapInfoLocator.length, pictureStart)
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
        creators: [{username: username}]
    }

    map.files = [{
        type: 'world', 
        worldUrl: "https://minecraftmaps.com" + html.querySelector('.jdbutton')?.getAttribute('href'), 
        minecraftVersion: statsPanel?.querySelectorAll('tr')[3].querySelectorAll('span')[1].textContent + "", 
        contentVersion: statsPanel?.querySelectorAll('tr')[2].querySelectorAll('span')[1].textContent + ""}]
    let images = html.querySelector('.jd-item-page')?.querySelectorAll('img')
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

    return map;
}