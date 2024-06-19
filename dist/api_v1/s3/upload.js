var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Upload } from "@aws-sdk/lib-storage";
import { S3 } from "@aws-sdk/client-s3";
import { sendLog } from '../logging/logging.js';
const bucket = new S3({
    region: 'us-west-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID + "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY + ""
    }
});
export function upload(file, name) {
    return __awaiter(this, void 0, void 0, function* () {
        name = name + Math.floor(Math.random() * 1000);
        const params = {
            Bucket: 'mccreations',
            Key: name,
            Body: file
        };
        try {
            const u = new Upload({
                client: bucket,
                params
            });
            yield u.done().catch((e) => {
                sendLog("upload", e);
                console.error(e);
            });
            return "https://mccreations.s3.us-west-1.amazonaws.com/" + name;
        }
        catch (error) {
            sendLog("upload", error);
            return error;
        }
    });
}
