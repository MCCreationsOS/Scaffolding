import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { ContentType, Creation } from "../schemas/creation";
import { JSDOM } from 'jsdom'
import { UserTypes } from '../schemas/user';
import { ObjectId } from 'mongodb';
import { downloadFileFromDropbox, downloadFileFromGoogleDrive, downloadFileFromMediafire, downloadFileFromOneDrive } from './utils';
import { Readable } from 'stream';
import { uploadFromStream } from '../storage';

let downloadableSites = ["dropbox.com", "mediafire.com", "planetminecraft.com", "drive.google.com"]

export default async function fetchFromPMC(url: string, type: ContentType) {
    try {
        let map: Creation | undefined = undefined;
        // Because of recent DDOS attacks PMC is using Cloudflare's anti-bot protection
        // This makes it difficult to scrape the page, so we need to use puppeteer to bypass it
        puppeteer.use(StealthPlugin())
        // Puppeteer needs a display adapter to run. The server is running X11, so we need to use the DISPLAY environment variable to tell puppeteer to use the correct display
        const browser = await puppeteer.launch({headless: false, env: {DISPLAY: ':10.0', CHROME_DEVEL_SANDBOX:"/usr/local/sbin/chrome-devel-sandbox"}});
            try {
                let timeoutSeconds = 30;
                const page = await browser.newPage();
                
                await page.goto(url);
                try {


                    let data = await page.content()
                    // We can assume the page has loaded if the title of the project is present
                    await page.waitForSelector('div#resource-title-text h1', {timeout: timeoutSeconds * 1000})
                    data = await page.content()
                    console.log("PMC Map Page loaded")
                    // Create a DOM object from the page content so we can use the DOM API to scrape the page
                    let html = new JSDOM(data).window.document

                    let creator = html.querySelector('.mini-info')?.querySelector('a.pusername')?.textContent?.trim() ?? "--failed--"
                
                    map = {
                        _id: new ObjectId(),
                        title: html.querySelector('div#resource-title-text h1')?.textContent?.trim() ?? "--failed--",
                        slug: html.querySelector('div#resource-title-text h1')?.textContent?.trim() ?? "--failed--",
                        description: html.querySelector('#r-text-block')?.innerHTML ?? "--failed--",
                        shortDescription: "",
                        status: 0,
                        downloads: 0,
                        views: 0,
                        rating: 0,
                        createdDate: new Date().toISOString(),
                        updatedDate: new Date().toISOString(),
                        ratings: [],
                        tags: [],
                        images: [],
                        creators: [{username: creator, handle: "", email: "", type: UserTypes.Account, _id: new ObjectId()}],
                        importedUrl: url,
                        type: type
                    }
                    
                    if(!map || !map.title || !map.slug || !map.description || !map.creators || !map.type || map.title === "--failed--" || map.slug === "--failed--") return undefined;
                    
                    let images = html.querySelectorAll('.rsImg')
                    images.forEach(async (image, idx) => {
                        let url = image.getAttribute('href')!
                        if(url.startsWith("https://static.planetminecraft.com")) map!.images.push(url)
                        if(url.includes("youtube.com") || url.includes("youtu.be")) map!.videoUrl = url
                    })

                    let downloadLink = html.querySelector('.branded-download')?.getAttribute('href')
                    let fileUrl = ""
                    if(downloadLink && downloadLink.includes("mirror")) {
                        page.goto(downloadLink)
                        try {
                            await page.waitForSelector('#continue-download')
                            page.click('#continue-download')
                            await page.waitForNavigation();

                            try {
                                if(page.url().includes("dropbox.com")) {
                                    fileUrl = await downloadFileFromDropbox(page)
                                } else if(page.url().includes("mediafire.com")) {
                                    fileUrl = await downloadFileFromMediafire(page)
                                } else if(page.url().includes("drive.google.com")) {
                                    fileUrl = await downloadFileFromGoogleDrive(page)
                                } else if(page.url().includes("onedrive.com")) {
                                    fileUrl = await downloadFileFromOneDrive(page)
                                } else {
                                    fileUrl = page.url()
                                }
                            } catch(e) {
                                console.log("Error downloading file: " + e)
                                fileUrl = page.url()
                            }
                        } catch(e) {
                            const data =await page.content()
                            console.log(data)
                            fileUrl = page.url()
                        }
                        
                        
                    } else if(downloadLink) {
                        const client = await page.createCDPSession();
                        client.on('Browser.downloadWillBegin', async (event) => {
                            client.send('Browser.cancelDownload', {guid: event.guid})
                            
                            const response = await fetch(event.url)
                            if(response.ok && response.body) {
                                const stream = Readable.fromWeb(response.body as any)
                                const location = await uploadFromStream(stream, "files", event.suggestedFilename, "application/zip")
                                return location
                            }
                        })
                        await page.goto(downloadLink)
                    }


                    if(type === 'map') map.files = [{type: 'world', url: fileUrl, minecraftVersion: [], createdDate: new Date().toISOString(), contentVersion: "1.0", extraFiles: []}]
                    if(type === 'datapack') map.files = [{type: "data", url: fileUrl, minecraftVersion: [], createdDate: new Date().toISOString(), contentVersion: "1.0", extraFiles: []}]
                    if(type === 'resourcepack') map.files = [{type: "resource", url: fileUrl, minecraftVersion: [], createdDate: new Date().toISOString(), contentVersion: "1.0", extraFiles: []}]

                } catch(e) {
                    console.log("Error loading page: " + e)
                    return `Error loading page: ${e}`
                    
                }
            } catch(e) {
                console.log("Error fetching page using puppeteer: " + e)
                return `Error fetching page using puppeteer: ${e}`
            }
    return map;
        
    } catch (e) {
        console.log("Error fetching PMC: " + e)
        return `Error fetching PMC: ${e}`;
    }
}