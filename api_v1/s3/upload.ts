import { Upload } from "@aws-sdk/lib-storage";
import { S3 } from "@aws-sdk/client-s3";
import fs from 'fs'
import papa from 'papaparse'
import { Readable } from "stream";
import { sendLog } from '../logging/logging.js';

const bucket = new S3({
    region: 'us-west-1',

    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID + "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY + ""
    }
});

export async function upload(file: File | string | Readable | Buffer | Uint8Array | Blob, name: string): Promise<string| any> {
    name = name + Math.floor(Math.random() * 1000)
    const params = {
        Bucket: 'mccreations',
        Key: name,
        Body: file
    }
    try {
        const u = new Upload({
            client: bucket,
            params
        });
        await u.done().catch((e) => {
            sendLog("upload", e)
            console.error(e)
        });
        return "https://mccreations.s3.us-west-1.amazonaws.com/" + name
    } catch (error) {
        sendLog("upload", error)
        return error;
    }
}