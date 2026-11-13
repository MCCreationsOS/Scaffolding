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
    if(!translations) {
        return res.status(404).send({error: "Language not found"})
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
    let language: Record<string, unknown>
    try {
        language = typeof req.body === "string" ? JSON.parse(req.body) : req.body
    } catch (e) {
        return res.status(400).send({error: "Invalid JSON"})
    }
    if (!language || typeof language !== "object" || Array.isArray(language)) {
        return res.status(400).send({error: "Invalid language"})
    }
    // Never let the body move the document to a different language or replace its id
    delete (language as any)._id
    delete (language as any).language_code

    const database = new Database("backend", "translations")
    // returnDocument "after" so a newly created language is returned too (otherwise this is null and no reply is sent)
    const updated = await database.collection.findOneAndUpdate(
        {language_code: req.params.lang},
        {$set: {...language, language_code: req.params.lang, updated_at: new Date()}},
        {upsert: true, returnDocument: "after"}
    )
    return res.status(200).send(updated ?? {})
})
