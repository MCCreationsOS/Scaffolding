import { Readable } from "stream";
import { optimizeImage } from "../../storage/optimize";
import { uploadFromStream } from "../../storage";
import { Router } from "../router";

Router.app.post("/upload", async (req, res) => {
    const parts = req.files()
    // A creations slug when images are uploaded to a creation or a users handle when images are uploaded to a user profile
    // Uploads stay open to people without accounts, but forWhat becomes part of the storage path,
    // so only allow simple path-safe characters
    const rawLocation = (await req.formData()).get("forWhat")
    const uploadLocation = String(rawLocation ?? "").replace(/[^A-Za-z0-9_\-]/g, "_").slice(0, 100) || "misc"
    let files: {type: string, name: string, location: string}[] = []
    for await (const data of parts) {
        if(data.mimetype.includes("image")) {
            let file: Readable = data.file
            let filename = data.filename
            let mimetype = data.mimetype
            if(!data.mimetype.includes("svg")) {
                file = optimizeImage(data.file)
                mimetype = "image/webp"
                filename = (data.filename.replace(/\.[^.]+$/, "") || "image") + ".webp"
            }
            let location = await uploadFromStream(file, `images/${uploadLocation}`, filename, mimetype)
            files.push({type: "image", name: filename, location: location})
        } else {
            let location = await uploadFromStream(data.file, `files/${uploadLocation}`, data.filename, data.mimetype)
            files.push({type: "file", name: data.filename, location: location})
        }

    }
    res.send({
        files: files
    })
})
