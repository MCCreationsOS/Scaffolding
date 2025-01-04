import { PutObjectCommand, S3 } from "@aws-sdk/client-s3";
import { StreamingBlobPayloadInputTypes } from "@smithy/types";
import { app } from '../index';
import formidable from 'formidable';
import stream from 'stream';
import { Upload } from "@aws-sdk/lib-storage";
import { Database } from "../db/connect";
import { getUserFromJWT } from "../auth/routes";
const bucket = new S3({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID + "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY + ""
    }
});

const uploads: Promise<any>[] = []

export async function upload(file: StreamingBlobPayloadInputTypes, name: string, location: string) {
    const params = {
        Bucket: process.env.AWS_BUCKET,
        Key: `${location}/${name}`,
        Body: file
    }
    try {
        const command = new PutObjectCommand(params)
        const response = await bucket.send(command)
        console.log(response)
        if(response.$metadata.httpStatusCode === 200) {
            return `https://mccreations.s3.us-west-1.amazonaws.com/${location}/${name}`
        } else {
            console.error(response)
            return
        }
    } catch (error) {
        console.error(error)
        return undefined;
    }
}
function fileWriteStreamHandler(file) {
    const key = (file.mimetype.includes("image")) ? "images" : "files"

    const body = new stream.PassThrough()
    const upload = new Upload({
        client: bucket,
        queueSize: 4,
        partSize: 1024 * 1024 * 5,
        leavePartsOnError: false,
        params: {
            Bucket: process.env.AWS_BUCKET,
            Key: `${key}/${file.originalFilename}`,
            ContentType: file.mimetype,
            Body: body
        }
    })
    const uploadRequest = upload.done().then((response) => {
        file.location = response.Location
    })
    uploads.push(uploadRequest)
    return body
}

export function initializeUploadRoutes() {
    app.post('/upload', async (req, res) => {
        const form = formidable({
            multiples: true,
            fileWriteStreamHandler: fileWriteStreamHandler,
        })
        form.parse(req, (err, fields, files) => {
            Promise.all(uploads).then(async () => {
                res.json({
                    files: files.files.map((file) => ({
                        name: file.originalFilename,
                        location: file.location,
                        type: file.mimetype
                    }))
                })
                const database = new Database("backend", "files")
                const user = await getUserFromJWT(req.headers.authorization + "")
                database.collection.insertMany(files.files.map((file) => ({
                    name: file.originalFilename,
                    location: file.location,
                    type: file.mimetype,
                    user: user.user?._id
                })))
            })
        })
    })
}