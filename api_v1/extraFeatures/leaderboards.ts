import { mkdirSync, writeFile } from "fs";


const MAX_TIME = 360_000;

export async function generateSubmissionFunctions(startPath, type, slug, message_text, formatting) {
    return new Promise((resolve) => {
        writeFile(startPath + "data/mccreations/function/leaderboards/submit/gen.mcfunction", `execute if score @s MCCreations.Leaderboards.Time matches 0..360000 run function mccreations:leaderboards/submit/gen/node`, () => {});
        resolve(bt(0, MAX_TIME, startPath + "data/mccreations/function/leaderboards/submit/gen", "gen", type, slug, message_text, formatting));
    })
}

function bt(min: number, max: number, path: string, dataPath: string, type: string, slug: string, message_text: string, formatting: string) {
    let text = ""
    if(max - min < 200) {
        for(let i = min; i <= max; i++) {
            text += `execute if score @s MCCreations.Leaderboards.Time matches ${i} run tellraw @s [{"text":"${message_text}", ${formatting} "clickEvent": {"action": "open_url", "value": "https://mccreations.net/leaderboards/${type}/${slug}/submit?time=${i}"}}]\n`
        }
        try {
            mkdirSync(path, {recursive: true})
        } catch (e) {
            if(e.code !== "EEXIST") {
                throw e;
            }
        }
        writeFile(path + `/node.mcfunction`, text, () => {});
    } else {
        let mid = Math.floor((min + max) / 2);
        try {
            mkdirSync(path, {recursive: true})
        } catch (e) {
            if(e.code !== "EEXIST") {
                throw e;
            }
        }

        text = `tellraw @a[tag=mccreations_leaderboards_debug] [{"text":"${path}","color":"green"}]\n`
        text += `execute if score @s MCCreations.Leaderboards.Time matches ${min}..${mid} run function mccreations:leaderboards/submit/${dataPath}/${min}_${mid}/node\n`
        text += `execute if score @s MCCreations.Leaderboards.Time matches ${mid+1}..${max} run function mccreations:leaderboards/submit/${dataPath}/${mid+1}_${max}/node`

        writeFile(path + `/node.mcfunction`, text, () => {});
        bt(min, mid, path + `/${min}_${mid}`, dataPath + `/${min}_${mid}`, type, slug, message_text, formatting);
        bt(mid+1, max, path + `/${mid+1}_${max}`, dataPath + `/${min}_${mid}`,type, slug, message_text, formatting);
    }
    return true
}