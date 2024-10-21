const en_US = import('./en-US.json')
const ru_RU = import('./ru-RU.json')
const zh_CN = import('./zh-CN.json')

const t = {
    "en-US": en_US,
    "ru-RU": ru_RU,
    "zh-CN": zh_CN
}


export async function getTranslation(lang: string, key: string, options?: any) {
    let translations = await(t[lang])
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