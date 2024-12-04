import axios from "axios";
import { JSDOM } from 'jsdom'
import jwt from 'jsonwebtoken'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

import { User } from "../auth/types.js";
import { Database } from "../db/connect.js";
import { ContentDocument } from "../db/types.js";
import { JWTKey } from "../auth/routes.js";
import { upload } from "../s3/upload.js";
import { sendLog } from "../logging/logging.js";
import showdown from "showdown";

export async function uploadContent(collection: string, body: any, uploader?: User) {
    let database = new Database("content", collection);

    let slug = body.content.title.toLowerCase().replace(/\s/g, "_").replace(/[^a-zA-Z0-9_]/g, "")
    console.log("Slug: " + slug)
    let i = "";
    let isSlugUnique = await checkIfSlugUnique(slug, collection)
    while(!isSlugUnique) {
        i += (Math.random() * 100).toFixed(0);
        isSlugUnique = await checkIfSlugUnique(slug + i, collection)
    }
    slug = slug + i;

    let content: ContentDocument = {
        title: body.content.title as string,
        shortDescription: body.content.summary as string,
        description: "",
        images: [],
        status: 0,
        downloads: 0,
        views: 0,
        slug: slug,
        rating: 0,
        createdDate: new Date(),
        type: body.content.type,
    }
    console.log("Attempting to insert map")
    let result = await database.collection.insertOne(content);
    console.log("Map inserted")

    if(uploader) {
        database.collection.updateOne({_id: result.insertedId}, {$push: {creators: {username: uploader.username, handle: uploader.handle}}, $set: {owner: uploader.handle}})
        return({slug: content.slug});
    } else {
        console.log("No user, creating temporary access key")
        let key = jwt.sign({_id: result.insertedId.toJSON()}, JWTKey, {expiresIn: "24h"})
        return({key: key, slug: content.slug});
    }
}

export async function fetchFromModrinth(url: string, type: string) {
    let converter = new showdown.Converter();
    let slug = url.substring(url.lastIndexOf('/') + 1)
    let response = await fetch(`https://api.modrinth.com/v2/project/${slug}`, {
        headers: {
            'User-Agent': 'MCCreationsOS/mccreations-next (mccreations.net)'
        }
    })
    let project = await response.json()
    // console.log(project)

    //check if project is a resourcepack or supports loader datapack
    if(project.project_type !== 'mod' && !project.loaders.includes('minecraft') && !project.loaders.includes('datapack')) {
        return;
    }

    let content: ContentDocument = {
        title: project.title,
        slug: project.slug,
        description: converter.makeHtml(project.body),
        shortDescription: project.description,
        status: 0,
        downloads: 0,
        views: 0,
        rating: 0,
        createdDate: new Date(),
        images: project.gallery.sort((a:any, b:any) => {
            return a.ordering - b.ordering
        }).map((image: any) => image.url),
        importedUrl: url,
        type: type
    }

    let vResponse = await fetch(`https://api.modrinth.com/v2/project/${slug}/version?loaders=["minecraft","datapack"]`, {
        headers: {
            'User-Agent': 'MCCreationsOS/mccreations-next (mccreations.net)'
        }
    })
    let versions = await vResponse.json()
    content.files = versions.map((version: any) => {
        if(version.loaders.includes('datapack')) {
            return {type: 'datapack', dataUrl: version.files[0].url, minecraftVersion: version.game_versions.join(', '), contentVersion: version.version_number}
        } else if (version.loaders.includes('minecraft')) {
            return {type: 'resourcepack', resourceUrl: version.files[0].url, minecraftVersion: version.game_versions.join(', '), contentVersion: version.version_number}
        }
    })
    console.log(content)
    return content
}

export async function fetchFromPMC(url: string, type: string) {
    try {
        let map: ContentDocument | undefined = undefined;
        puppeteer.use(StealthPlugin())
        const browser = await puppeteer.launch({headless: false, env: {DISPLAY: ':10.0', CHROME_DEVEL_SANDBOX:"/usr/local/sbin/chrome-devel-sandbox"}});
        let uploaded_images: TransferredImage[] = []
            try {
                let timeoutSeconds = 30;
                const page = await browser.newPage();
                
                await page.goto(url);
                try {


                    let data = await page.content()
                    await page.waitForSelector('div#resource-title-text h1', {timeout: 390100})
                    data = await page.content()
                    console.log("PMC Map Page loaded")
                    browser.close();
                    let html = new JSDOM(data).window.document

                    
    
        
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
                
                    map = {
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
                        importedUrl: url,
                        type: type
                    }
                    if(type === 'Maps') map.files = [{type: 'world', url: "https://www.planetminecraft.com" + html.querySelector('.branded-download')?.getAttribute('href'), minecraftVersion: '', createdDate: Date.now(), contentVersion: "1.0", extraFiles: []}]
                    if(type === 'datapacks') map.files = [{type: "datapack", url: "https://www.planetminecraft.com" + html.querySelector('.branded-download')?.getAttribute('href'), minecraftVersion: '', createdDate: Date.now(), contentVersion: "1.0", extraFiles: []}]
                    if(type === 'resourcepacks') map.files = [{type: "resourcepack", url: "https://www.planetminecraft.com" + html.querySelector('.branded-download')?.getAttribute('href'), minecraftVersion: '', createdDate: Date.now(), contentVersion: "1.0", extraFiles: []}]
                    let images = html.querySelectorAll('.rsImg')
                    images.forEach(async (image, idx) => {
                        let url = image.getAttribute('href')!
                        if(url.startsWith("https://static.planetminecraft.com")) map!.images.push(url)
                        if(url.includes("youtube.com") || url.includes("youtu.be")) map!.videoUrl = url
                    })

                    map.images.forEach(async (image, idx) => {
                        try {
                            let response = await axios.get(image);
                            let buffer = await response.data;
                            let url = await upload(new Uint8Array(buffer), 'images', `${map!.slug}_image_${idx}${image.substring(image.lastIndexOf('.'))}`);
                            if(url)
                            uploaded_images.push({transferredUrl: url, originalUrl: image})
                        } catch(e) {
                            console.log("Error uploading image: " + e)
                        }
                    })
                    for(let i = 0; i < map.images.length; i++) {
                        let image = uploaded_images.find(img => img.originalUrl === map!.images[i])
                        if(image) {
                            map.images[i] = image.transferredUrl
                        }
                    }
                } catch(e) {
                    sendLog("loadAndTransferImages", e)
                    console.log("Error loading page: " + e)
                    
                }
            } catch(e) {
                sendLog("loadAndTransferImages", e)
                console.log("Error fetching images using puppeteer: " + e)
            }
    return map;
        
    } catch (e) {
        console.log("Error fetching PMC: " + e)
        return undefined;
    }
}

export async function fetchFromMCMaps(url: string) {
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

    let map: ContentDocument = {
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
        importedUrl: url,
        type: 'map'
    }

    map.files = [{
        type: 'world', 
        worldUrl: "https://minecraftmaps.com" + html.querySelector('.jdbutton')?.getAttribute('href'), 
        minecraftVersion: statsPanel?.querySelectorAll('tr')[3].querySelectorAll('span')[1].textContent + "", 
        contentVersion: statsPanel?.querySelectorAll('tr')[2].querySelectorAll('span')[1].textContent + "", createdDate: Date.now()}]

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

// export async function loadAndTransferImages(map: ContentDocument) {
//     try {
//         puppeteer.launch().then(async browser => {
//             try {
//                 let idx = 0;
//                 let fileCounter = 0;
//                 let uploaded_images: TransferredImage[] = []
//                 let timeoutSeconds = 30;
//                 const page = await browser.newPage();
            
//                 page.on('response', async (response) => {
//                     try {
//                         const matches = /.*\.(jpg|png|svg|gif|webp)$/.exec(response.url());
//                         if (matches && (matches.length === 2) && (response.url().startsWith('https://www.minecraftmaps.com/images/jdownloads/screenshots/') || response.url().startsWith("https://static.planetminecraft.com/files/image/minecraft/"))) {
//                             console.log(matches);
//                             const extension = matches[1];
//                             const buffer = await response.buffer();
//                             fileCounter += 1;
//                             let url = await upload(buffer, `${map.slug}_image_${fileCounter}.${extension}`)
//                             uploaded_images.push({transferredUrl: url, originalUrl: response.url()})
//                         }
//                     } catch(e) {
//                         console.log("Error uploading image: " + e)
//                     }
//                   });
                
//                 await page.goto(map.importedUrl!);
//                 try {
//                     // page.mouse.wheel({deltaY: 2000})
    
//                     while(uploaded_images.length < map.images.length && timeoutSeconds > 0) {
//                         await new Promise(resolve => setTimeout(resolve, 1000));
//                         timeoutSeconds--;
//                     }
//                     await browser.close();
    
//                     if(timeoutSeconds <= 0) {
//                         return;
//                     }
                    
//                     let database = new Database();
//                     for(let i = 0; i < map.images.length; i++) {
//                         let image = uploaded_images.find(img => img.originalUrl === map.images[i])
//                         if(image) {
//                             map.images[i] = image.transferredUrl
//                         }
//                     }
//                     await database.collection.updateOne({slug: map.slug}, {$set: {images: map.images}})
//                 } catch(e) {
//                     sendLog("loadAndTransferImages", e)
//                     console.log("Error loading page: " + e)
                
//                 }
//             } catch(e) {
//                 sendLog("loadAndTransferImages", e)
//                 console.log("Error fetching images using puppeteer: " + e)
//             }
//         })
//     } catch(e) {
//         sendLog("loadAndTransferImages", e)
//         console.log("Error launching puppeteer: " + e)
//     }
// }

export async function checkIfSlugUnique(slug: string, collection: string) {
    let database = new Database("content", collection);
    return (await database.collection.findOne({slug: slug})) === null
}