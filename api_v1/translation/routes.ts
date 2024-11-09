import { getTranslation, getTranslations } from "."
import { app } from ".."
import { sendMessage } from "../../discord_bot"
import { Database } from "../db/connect"

export function initializeTranslationRoutes() {
    app.get("/translation/:lang/:key", async (req, res) => {
        let t = await getTranslation(req.params.lang, req.params.key)
        if(t) {
            res.send(t)
        } else {
            res.sendStatus(404)
        }
    })

    app.get("/translation/:lang", async (req, res) => {
        let t = await getTranslations(req.params.lang)
        if(t) {
            res.send(t)
        } else {
            res.sendStatus(404)
        }
    })

    app.post("/translation/:lang", async (req, res) => {
        const database = new Database("backend", "translations")
        let language = await database.collection.findOneAndUpdate({language_code: req.params.lang + "_queue"}, {$set: {...req.body, language_code: req.params.lang + "_queue"}}, {upsert: true})
        if(language) {
            res.sendStatus(204).send(language)
            sendMessage(`New Translation for ${req.params.lang} added to queue.`, "860288020908343346")
        } else {
            res.sendStatus(404)
        }
    })

    app.put("/translation/:lang/approve", async (req, res) => {
        const database = new Database("backend", "translations")
        let queue = await database.collection.findOne({language_code: req.params.lang + "_queue"})
        if(queue) {
            const {_id, language_code, ...rest} = queue
            await database.collection.updateOne({language_code: req.params.lang}, {$set: {...rest}})
            await database.collection.deleteOne({_id})
            res.sendStatus(204)
        } else {
            res.sendStatus(404)
        }
    })
}