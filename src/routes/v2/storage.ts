import { uploadFromStream } from "../../storage";
import { Router } from "../router";

Router.app.post("/upload", async (req, res) => {
    const parts = req.files()
    let files: {type: string, name: string, location: string}[] = []
    for await (const data of parts) {
        if(data.mimetype.includes("image")) {
            let location = await uploadFromStream(data.file, "images", data.filename, data.mimetype)
            files.push({type: "image", name: data.filename, location: location})
        } else {
            let location = await uploadFromStream(data.file, "files", data.filename, data.mimetype)
            files.push({type: "file", name: data.filename, location: location})
        }

    }
    res.send({
        files: files
    })
})

