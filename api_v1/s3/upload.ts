import { PutObjectCommand, S3 } from "@aws-sdk/client-s3";
import { StreamingBlobPayloadInputTypes } from "@smithy/types";

const bucket = new S3({
    region: 'us-west-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID + "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY + ""
    }
});

export async function upload(file: StreamingBlobPayloadInputTypes, name: string, location: string) {
    const params = {
        Bucket: 'mccreations',
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