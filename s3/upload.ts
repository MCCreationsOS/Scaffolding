import S3 from 'aws-sdk/clients/s3.js'
import fs from 'fs'
import papa from 'papaparse'
import { Readable } from "stream";

const bucket = new S3({
    region: 'us-west-1',
    accessKeyId: "***REMOVED***",
    secretAccessKey: "***REMOVED***"
});

export async function upload(file: File, name: string) {
    name = name + Math.floor(Math.random() * 1000)
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
        console.log("New file uploaded!")
        return "https://mccreations.s3.us-west-1.amazonaws.com/" + name
    } catch (error) {
        return error;
    }
}