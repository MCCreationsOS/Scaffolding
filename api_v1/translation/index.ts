import { Database } from "../db/connect"

export async function getTranslation(lang: string, key: string, options?: any) {
    let database = new Database("backend", "translations")
    let translations = await database.collection.findOne({language_code: lang})
    if(!translations) {
        return key
    }
    let keys = key.split(".")
    let translation = translations
    for(let key of keys) {
        translation = translation[key]
    }
    if(translation) {
        for(let option in options) {
            translation = translation.replace(`{${option}}`, options[option])
        }
        return translation
    }
    return key
}

export async function getTranslations(lang: string) {
    let database = new Database("backend", "translations")
    let translations = await database.collection.findOne({language_code: lang})
    return translations
}