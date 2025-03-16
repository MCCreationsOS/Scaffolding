import { TString, Type } from "@sinclair/typebox";
import { ErrorSchema, GenericResponseType } from "../../schemas/generic";
import { Router } from "../router";
import { getTranslation, getTranslations } from "../../translation";
import { Database } from "../../database";

Router.app.get<{
    Params: {
        lang: string
        key: string
    }
    Reply: GenericResponseType<TString>
}>("/translation/:lang/:key", async (req, res) => {
    let translation = await getTranslation(req.params.lang, req.params.key)
    if(translation) {
        return res.status(200).send(translation)
    } else {
        return res.status(404).send({error: "Translation not found"})
    }
})

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
    Body: Object
    Reply: GenericResponseType<any>
}>("/translation/:lang", async (req, res) => {
    const database = new Database("backend", "translations")
    let language = await database.collection.findOneAndUpdate({language_code: req.params.lang + "_queue"}, {$set: {...req.body, language_code: req.params.lang + "_queue"}}, {upsert: true})
    if(language) {
        return res.status(200).send(language)
    } else {
        database.insertOne({language_code: req.params.lang + "_queue", ...req.body})
        return res.status(200).send(req.body)
    }
})

Router.app.put<{
    Params: {
        lang: string
    }
    Reply: GenericResponseType<any>
}>("/translation/:lang/approve", async (req, res) => {
    const database = new Database("backend", "translations")
    let queue = await database.collection.findOne({language_code: req.params.lang + "_queue"})
    if(queue) {
        const {_id, language_code, ...rest} = queue
        await database.collection.updateOne({language_code: req.params.lang}, {$set: {...rest}})
        await database.collection.deleteOne({_id})
        return res.status(200).send(queue)
    } else {
        return res.status(404).send({error: "Queue not found"})
    }
})

