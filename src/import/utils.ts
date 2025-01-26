import { Page } from "puppeteer";
import { Readable } from "stream";
import { uploadFromStream } from "../storage";

export async function downloadFileFromDropbox(page: Page) {
    return new Promise<string>(async (resolve, reject) => {
        try {
            await page.waitForSelector('.dig-IconButton')

            subscribeToDownloadEvent(page).then(resolve).catch(reject)

            await page.click('.dig-IconButton[aria-label="Download"]')
            await page.waitForSelector('.dig-Button--transparent')
            await page.click('.dig-Button--transparent')
        } catch(e) {
            console.log("Error downloading file from dropbox: " + e)
            reject(e)
        }
    })
}

export async function downloadFileFromMediafire(page: Page) {
    return new Promise<string>(async (resolve, reject) => {
        try {
            subscribeToDownloadEvent(page).then(resolve).catch(reject)

            await page.waitForSelector('#download-button')
            await page.click('#download-button')
    } catch(e) {
            console.log("Error downloading file from mediafire: " + e)
            reject(e)
        }
    })
}

export async function downloadFileFromOneDrive(page: Page) {
    return new Promise<string>(async (resolve, reject) => {
        try {
            subscribeToDownloadEvent(page).then(resolve).catch(reject)

            await page.waitForSelector('button[aria-label="Download"]')
            await page.click('button[aria-label="Download"]')
    } catch(e) {
            console.log("Error downloading file from onedrive: " + e)
            reject(e)
        }
    })
}

export async function downloadFileFromGoogleDrive(page: Page) {
    return new Promise<string>(async (resolve, reject) => {
        try {
            subscribeToDownloadEvent(page).then(resolve).catch(reject)

            await page.waitForSelector('div[aria-label="Download"]')
            await page.click('div[aria-label="Download"]')
        } catch(e) {
            console.log("Error downloading file from google drive: " + e)
            reject(e)
        }
    })
}

export async function subscribeToDownloadEvent(page: Page) {
    return new Promise<string>(async (resolve, reject) => {
        const client = await page.createCDPSession()
        client.on('Browser.downloadWillBegin', async (event) => {
            client.send('Browser.cancelDownload', {guid: event.guid})
            
            const response = await fetch(event.url)
            if(response.ok && response.body) {
                const stream = Readable.fromWeb(response.body as any)
                const location = await uploadFromStream(stream, "files", event.suggestedFilename, "application/zip")
                resolve(location)
            } else {
                reject(new Error("Error downloading file from " + event.url))
            }
        })
    })
}