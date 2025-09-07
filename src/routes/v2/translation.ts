import { TString, Type } from "@sinclair/typebox";
import { ErrorSchema, GenericResponseType } from "../../schemas/generic";
import { Router } from "../router";
import { getTranslation, getTranslations } from "../../translation";
import { Database } from "../../database";

Router.app.get<{
    Params: {
        lang: string
    }
    Reply: GenericResponseType<any>
}>("/translation/:lang", async (req, res) => {
    let translations = await getTranslations(req.params.lang)
    if(!translations && req.params.lang.includes("queue")) {
        let queue = await getTranslations(req.params.lang.replace("_queue", ""))
        if(queue) {
            return res.status(200).send(queue)
        } else {
            return res.status(404).send({error: "Queue not found"})
        }
    }
    return res.status(200).send(translations)
})

Router.app.post<{
    Params: {
        lang: string
    }
    Body: string
    Reply: GenericResponseType<any>
}>("/translation/:lang", async (req, res) => {
    const database = new Database("backend", "translations")
    let language = await database.collection.findOneAndUpdate({language_code: req.params.lang}, {$set: {...JSON.parse(req.body), updated_at: new Date()}}, {upsert: true})
    if(language) {
        return res.status(200).send(language)
    }
})

Router.app.put<{
    Params: {
        lang: string
    }
    Reply: GenericResponseType<any>
}>("/translation/approve/:lang", async (req, res) => {
    const database = new Database("backend", "translations")
    let language = await database.collection.findOne({language_code: req.params.lang})
    if(language) {
        return res.status(200).send(language)
    } else {
        return res.status(404).send({error: "Language not found"})
    }
})

