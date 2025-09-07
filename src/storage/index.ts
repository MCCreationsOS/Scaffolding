import { S3 } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable } from "stream";
import { Database } from "../database";
import { User } from "discord.js";
import { ObjectId } from "mongodb";

const bucket = new S3({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID + "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY + ""
    }
});

export function uploadFromStream(stream: Readable, key: string, filename: string, mimetype: string, user?: User) {
    if(!process.env.AWS_BUCKET) throw new Error("AWS_BUCKET is not set")
    if(!process.env.AWS_REGION) throw new Error("AWS_REGION is not set")
    if(!process.env.AWS_ACCESS_KEY_ID) throw new Error("AWS_ACCESS_KEY_ID is not set")
    if(!process.env.AWS_SECRET_ACCESS_KEY) throw new Error("AWS_SECRET_ACCESS_KEY is not set")
    
    let database = new Database("backend", "files")
    return new Promise<string>((resolve, reject) => {
        console.log("Uploading file to s3")
        const abortController = new AbortController()
        const upload = new Upload({

            client: bucket,
            queueSize: 4,
            partSize: 1024 * 1024 * 5,
            leavePartsOnError: false,
            abortController: abortController,
            params: {
                Bucket: process.env.AWS_BUCKET,
                Key: `${key}/${filename}`,
                ContentType: mimetype,
                Body: stream
            }
        })
        upload.on("httpUploadProgress", (progress) => {
            if(progress.total && progress.total > 1024 * 1024 * 30) {
                abortController.abort()
            }
            if(progress.loaded && progress.loaded > 1024 * 1024 * 30) {
                abortController.abort()
            }
        })
        upload.done().then((response) => {
            if(response.Location) {
                database.insertOne({
                    _id: new ObjectId(),
                    filename: filename,
                    mimetype: mimetype,
                    location: response.Location,
                    user: user
                })
                resolve(response.Location)
            }
            else reject(new Error("Error uploading file to s3"))


        }).catch((error) => {
            reject(error)
        })
    })
}

export function uploadFromFile(file: Uint8Array, key: string, filename: string, mimetype: string) {
    return new Promise<string>((resolve, reject) => {
        const stream = Readable.from(file)
        uploadFromStream(stream, key, filename, mimetype).then(resolve).catch(reject)
    })
}

export function downloadFile(url: string) {
    return new Promise<Uint8Array>(async (resolve, reject) => {
        const response = await fetch(url)
        if(response.ok) {
            const arrayBuffer = await response.arrayBuffer()
            resolve(new Uint8Array(arrayBuffer))
        } else {
            reject(new Error("Error downloading file from s3"))
        }
    })
}