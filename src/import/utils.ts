import { Page } from "puppeteer";
import { Readable } from "stream";
import { uploadFromStream } from "../storage";
import { createReadStream, watch } from "fs";

export async function downloadFileFromDropbox(page: Page) {
    return new Promise<string>(async (resolve, reject) => {
        try {
            await page.waitForSelector('.dig-IconButton')

            subscribeToDownloadEvent(page).then(resolve).catch(reject)

            await page.click('.dig-IconButton[aria-label="Download"]')
            await page.waitForSelector('text/Or continue with download only')
            await page.click('text/Or continue with download only')
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
        client.send("Browser.setDownloadBehavior", {
            behavior: "allow",
            downloadPath: "./temp"
        })

        let file = ""

        watch("./temp", (event, filename) => {
            if(event === "rename" && filename?.endsWith(".crdownload")) {
                file = filename.replace(".crdownload", "")
            } else if(event === "rename" && filename?.endsWith(".zip") && file === filename) {
                const fstream = createReadStream(`./temp/${filename}`)
                uploadFromStream(fstream, "files", filename, "application/zip").then((url) => {
                    resolve(url)
                })
            }
        })

        setTimeout(() => {
            resolve(page.url())
        }, 10000)
    })
}