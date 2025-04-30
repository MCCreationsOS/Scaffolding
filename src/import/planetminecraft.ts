import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { ContentType, Creation } from "../schemas/creation";
import { JSDOM } from 'jsdom'
import { UserTypes } from '../schemas/user';
import { ObjectId } from 'mongodb';
import { downloadFileFromDropbox, downloadFileFromGoogleDrive, downloadFileFromMediafire, downloadFileFromOneDrive, subscribeToDownloadEvent } from './utils';
import { convertContentTypeToCollectionName, makeUniqueSlug } from '../utils/database';
import { ProgressStream } from '../utils/creations';

export default async function fetchFromPMC(url: string, type: ContentType, stream: ProgressStream) {
    try {
        let map: Creation | undefined = undefined;
        // Because of recent DDOS attacks PMC is using Cloudflare's anti-bot protection
        // This makes it difficult to scrape the page, so we need to use puppeteer to bypass it
        puppeteer.use(StealthPlugin())
        stream.sendUpdate("progress", {message: "Create.Import.PMC", progress: 10})
        // Puppeteer needs a display adapter to run. The server is running X11, so we need to use the DISPLAY environment variable to tell puppeteer to use the correct display
        const browser = await puppeteer.launch({headless: false, env: {DISPLAY: ':10.0', CHROME_DEVEL_SANDBOX:"/usr/local/sbin/chrome-devel-sandbox"}});

            try {
                let timeoutSeconds = 30;
                let page = await browser.newPage();
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
                        createdDate: Date.now(),
                        updatedDate: Date.now(),
                        ratings: [],
                        tags: [],
                        images: [],
                        creators: [{username: creator, handle: "", email: "", type: UserTypes.Account, _id: new ObjectId()}],
                        importedUrl: url,
                        type: type
                    }

                    map.slug = await makeUniqueSlug(map.title.toLowerCase().replace(/ /g, "-"), convertContentTypeToCollectionName(type))

                    if(!map || !map.title || !map.slug || !map.description || !map.creators || !map.type || map.title === "--failed--" || map.slug === "--failed--") return undefined;
                    
                    // Get all the images in the gallery
                    let images = html.querySelectorAll('.rsImg')
                    images.forEach(async (image, idx) => {
                        let url = image.getAttribute('href')!
                        if(url.startsWith("https://static.planetminecraft.com")) map!.images.push(url)
                        if(url.includes("youtube.com") || url.includes("youtu.be")) map!.videoUrl = url
                    })

                    let downloadLink = "https://www.planetminecraft.com" + html.querySelector('.branded-download')?.getAttribute('href')
                    let fileUrl = ""
                    /*
                    There are two types of download links:
                    - A download link that goes to a mirror site
                    - A download link that downloads the file directly from PMC
                    
                    If the download link goes to a mirror site, we need to click the download button, click the confirmation button, potentially wait for a preroll, and then handle the download from the mirror site.
                    If the download link goes to the PMC download page, we need to click the download button, wait for a preroll, and then download the file.
                    */
                    if(downloadLink && downloadLink.includes("mirror")) {
                        stream.sendUpdate("progress", {message: "Create.Import.PMC", progress: 30}) 
                        await page.click(".branded-download")
                        try {
                            // Wait for the continue download popup
                            await page.waitForSelector('#continue_download')

                            console.log("Clicking continue download")
                            await page.click('#continue_download')
                            // Clicking continue opens the download page in a new tab, so we need to navigate to it
                            await new Promise(resolve => setTimeout(resolve, 500))
                            let pages = await browser.pages()
                            page = pages[2]
                            try {
                                // If there is no preroll, we can download the file directly
                                if(page.url().includes("dropbox.com")) {
                                    stream.sendUpdate("progress", {message: "Create.Import.downloading", options: {host: "dropbox"}, progress: 60})
                                    fileUrl = await downloadFileFromDropbox(page)
                                } else if(page.url().includes("mediafire.com")) {
                                    stream.sendUpdate("progress", {message: "Create.Import.downloading", options: {host: "mediafire"}, progress: 60})
                                    fileUrl = await downloadFileFromMediafire(page)
                                } else if(page.url().includes("drive.google.com")) {
                                    stream.sendUpdate("progress", {message: "Create.Import.downloading", options: {host: "google drive"}, progress: 60})
                                    fileUrl = await downloadFileFromGoogleDrive(page)
                                } else if(page.url().includes("onedrive.com")) {
                                    stream.sendUpdate("progress", {message: "Create.Import.downloading", options: {host: "onedrive"}, progress: 60})
                                    fileUrl = await downloadFileFromOneDrive(page)
                                } else {
                                    // If there is a preroll, we need to wait for it to finish and then download the file. Preroll is 5 seconds so we wait 5 and a bit.
                                    stream.sendUpdate("progress", {message: "Create.Import.preroll", progress: 60})
                                    await new Promise(resolve => setTimeout(resolve, 5500))
                                    await page.waitForSelector('#prerollDownload')
                                    await page.click('#prerollDownload')
                                    // Wait for the mirror page to be navigated to and completly resolve redirects
                                    await new Promise(resolve => setTimeout(resolve, 2000))

                                    if(page.url().includes("dropbox.com")) {
                                        stream.sendUpdate("progress", {message: "Create.Import.downloading", options: {host: "dropbox"}, progress: 90})
                                        fileUrl = await downloadFileFromDropbox(page)
                                    } else if(page.url().includes("mediafire.com")) {
                                        stream.sendUpdate("progress", {message: "Create.Import.downloading", options: {host: "mediafire"}, progress: 90})
                                        fileUrl = await downloadFileFromMediafire(page)
                                    } else if(page.url().includes("drive.google.com")) {
                                        stream.sendUpdate("progress", {message: "Create.Import.downloading", options: {host: "google drive"}, progress: 90})
                                        fileUrl = await downloadFileFromGoogleDrive(page)
                                    } else if(page.url().includes("onedrive.com")) {
                                        stream.sendUpdate("progress", {message: "Create.Import.downloading", options: {host: "onedrive"}, progress: 90})
                                        fileUrl = await downloadFileFromOneDrive(page)
                                    } else {
                                        stream.sendUpdate("progress", {message: "Create.Import.unknown", progress: 90})
                                        fileUrl = page.url()
                                    }
                                }
                            } catch(e) {
                                stream.sendUpdate("error", "Error downloading file: " + e)
                                fileUrl = page.url()
                            }
                        } catch(e) {
                            stream.sendUpdate("error", "Error downloading file: " + e)
                            fileUrl = page.url()
                        }

                    } else if(downloadLink) {
                        // If the download link goes to the PMC download page, we need to click the download button, wait for a preroll, and then download the file.
                        stream.sendUpdate("progress", {message: "Create.Import.PMC", progress: 30})
                        await page.click(".branded-download")
                        // Clicking the download button opens the download page in a new tab, so we need to navigate to it
                        await new Promise(resolve => setTimeout(resolve, 500))
                        let pages = await browser.pages()
                        page = pages[2]
                        // We subscribe to the download event ahead of time to make sure we can catch the event when it happens, however we don't actually wait for it until the preroll is finished
                        let t = subscribeToDownloadEvent(page)
                        // Wait for the preroll to finish
                        await new Promise(resolve => setTimeout(resolve, 5500))
                        stream.sendUpdate("progress", {message: "Create.Import.preroll", progress: 60})
                        await page.waitForSelector('#prerollDownload')
                        await page.click('#prerollDownload')
                        stream.sendUpdate("progress", {message: "Create.Import.downloading", options: {host: "PMC"}, progress: 90})
                        // Wait for the download to finish
                        fileUrl = await t
                    }
                    await browser.close()

                    if(type === 'map') map.files = [{type: 'world', url: fileUrl, minecraftVersion: [], createdDate: Date.now(), contentVersion: "1.0", extraFiles: []}]
                    if(type === 'datapack') map.files = [{type: "data", url: fileUrl, minecraftVersion: [], createdDate: Date.now(), contentVersion: "1.0", extraFiles: []}]
                    if(type === 'resourcepack') map.files = [{type: "resource", url: fileUrl, minecraftVersion: [], createdDate: Date.now(), contentVersion: "1.0", extraFiles: []}]

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