var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import S3 from 'aws-sdk/clients/s3.js';
const bucket = new S3({
    region: 'us-west-1',
    accessKeyId: "***REMOVED***",
    secretAccessKey: "***REMOVED***"
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
            const u = bucket.upload(params);
            yield u.promise().catch(error => {
                console.error(error);
            });
            console.log("New file uploaded!");
            return "https://mccreations.s3.us-west-1.amazonaws.com/" + name;
        }
        catch (error) {
            return error;
        }
    });
}
