import { createWriteStream, mkdirSync, readFileSync, rmdir } from "fs"
import { Readable } from "stream"
import { cloneRepository, compressFolder, unzip } from "./utils"
import { generateSubmissionFunctions } from "../../extraFeatures/leaderboards"
import { upload } from "../../s3/upload"
import { mkdir } from "fs/promises"

export async function injectLeaderboards(mapFile: string, slug: string, type: string, message: string, messageFormatting: string) {
    return new Promise<string>(async (resolve, reject) => {
        const r = await fetch(mapFile)
        if(r.ok && r.body) {
            await mkdir("tmp").catch(() => {})
            const writeStream = createWriteStream("tmp/" + slug + ".zip")
            Readable.fromWeb(r.body as any).pipe(writeStream)
    
    
            writeStream.on('close', async () => {
                let folder = await unzip("tmp/" + slug + ".zip", "tmp/")
                await mkdir("tmp/" + folder + "/datapacks/mccleaderboards", {recursive: true})
                await cloneRepository("https://github.com/MCCreationsOS/Java-Leaderboards.git", "tmp/" + folder + "/datapacks/mccleaderboards")
                generateSubmissionFunctions(`tmp/${folder}/datapacks/mccleaderboards/older_versions/`, type, slug, message, messageFormatting)
                await generateSubmissionFunctions(`tmp/${folder}/datapacks/mccleaderboards/`, type, slug, message, messageFormatting)
                await compressFolder(`tmp/${folder}/`, `tmp/${slug}`)
                const f = readFileSync(`tmp/${slug}.zip`)
                upload(f, `${slug + Date.now()}.zip`, "files").then((url) => {
                    if(url) {
                        resolve(url)
                    } else {
                        reject("Failed to upload")
                    }
                    rmdir("tmp", {recursive: true}, () => {})
                })
            })
        }
    })
}