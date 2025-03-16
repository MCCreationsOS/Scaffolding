import naughtyWords from "naughty-words";

const htmlRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>?/gi

export function containsProfanity(text: string) {
    text = text.replace(htmlRegex, "")

    let found = false
    Object.keys(naughtyWords).forEach((language) => {
        if(language in naughtyWords) {
            naughtyWords[language as keyof typeof naughtyWords].forEach((word: string) => {
                if(text.includes(word)) {
                    found = true
                }
            })
        }
    })
    return found
}