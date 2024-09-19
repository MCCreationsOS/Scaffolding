import archiver from "archiver"
import { createWriteStream, mkdirSync } from "fs"
import simpleGit from "simple-git"
import {open} from "yauzl";
import path from "path";

export function compressFolder(folderPath: string, outputPath: string) {
    let zip = archiver('zip', {zlib: { level: 9 }})
    let output = createWriteStream(`${outputPath}.zip`)
    let p = new Promise<string>((resolve, reject) => {
        output.on('close', () => {
            resolve(outputPath)
        })
        output.on('error', (err) => {
            reject(err)
        })
    })

    zip.pipe(output)
    zip.directory(folderPath, false)
    zip.finalize()
    return p
}

export function cloneRepository(remote: string, path: string) {
    return new Promise<void>((resolve, reject) => {
        const git = simpleGit(path);
        setTimeout(() => {
            resolve()    
        }, 1000)
        git.init().addRemote("origin", remote).pull("origin", "main")
    })
}

export function unzip(zip: string, outputPath: string) {
    return new Promise<string>((resolve, reject) => {
        let exportPath = ""
        open(zip, {lazyEntries: true}, (err, zipfile) => {
            if(err) {
                console.log(err)
                return;
            }

            zipfile.readEntry()

            zipfile.on('end', () => {
                resolve(exportPath)
            })
            zipfile.on('error', (err) => {
                console.log(err)
                reject(err)
            })

            zipfile.on('entry', (entry) => {
                if(/\/$/.test(entry.fileName)) {
                    zipfile.readEntry()
                } else {
                    zipfile.openReadStream(entry, (err, readStream) => {
                        if(err) {
                            console.log(err)
                            return;
                        }
                        readStream.on('end', () => {
                            zipfile.readEntry()
                        })

                        if(exportPath.length === 0) {
                            exportPath = entry.fileName.substring(0, entry.fileName.lastIndexOf("/"))
                        }

                        const pathname = path.resolve(outputPath, entry.fileName)
                        mkdirSync(path.dirname(pathname), {recursive: true})
                        readStream.pipe(createWriteStream(outputPath + entry.fileName))

                    })
                }
            })
        })
    })
}