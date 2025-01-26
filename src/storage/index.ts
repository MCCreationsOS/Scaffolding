import { S3 } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable } from "stream";

const bucket = new S3({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID + "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY + ""
    }
});

export function uploadFromStream(stream: Readable, key: string, filename: string, mimetype: string) {
    return new Promise<string>((resolve, reject) => {
        const upload = new Upload({
            client: bucket,
            queueSize: 4,
            partSize: 1024 * 1024 * 5,
            leavePartsOnError: false,
            params: {
                Bucket: process.env.AWS_BUCKET,
                Key: `${key}/${filename}`,
                ContentType: mimetype,
                Body: stream
            }
        })
        upload.done().then((response) => {
            if(response.Location) resolve(response.Location)
            else reject(new Error("Error uploading file to s3"))
        }).catch((error) => {
            reject(error)
        })
    })
}
