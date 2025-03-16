import showdown from "showdown";
import { ContentType, Creation, File } from "../schemas/creation";
import { ObjectId } from "mongodb";
import { makeUniqueSlug } from "../utils/database";
import { convertContentTypeToCollectionName } from "../utils/database";
import { ProgressStream } from "../utils/creations";
import { Readable } from "stream";
import { uploadFromStream } from "../storage";

export default async function fetchFromModrinth(url: string, type: ContentType, stream: ProgressStream) {
    stream.sendUpdate("progress", {message: "Create.Import.Modrinth", progress: 10})
    let converter = new showdown.Converter();
    let slug = url.substring(url.lastIndexOf('/') + 1)
    let response = await fetch(`https://api.modrinth.com/v2/project/${slug}`, {

        headers: {
            'User-Agent': 'MCCreationsOS/mccreations-next (mccreations.net)'
        }
    })
    let project = await response.json()
    stream.sendUpdate("progress", {message: "Create.Import.Modrinth", progress: 30})
    // console.log(project)

    // Check to make sure the project is either a resourcepack or a datapack
    // They are both considered "mods", but resourcepacks use the "minecraft" loader and datapacks use the "datapack" loader
    if(project.project_type !== 'mod' && !project.loaders.includes('minecraft') && !project.loaders.includes('datapack')) {
        return `Invalid project type: ${project.project_type}`;
    }

    let content: Creation = {
        _id: new ObjectId(),
        ratings: [],
        tags: [],
        updatedDate: new Date(),
        creators: [],
        title: project.title,
        slug: project.slug,
        // Modrinth uses markdown for descriptions, so we need to convert it to HTML
        description: converter.makeHtml(project.body),
        shortDescription: project.description,
        status: 0,
        downloads: 0,
        views: 0,
        rating: 0,
        createdDate: new Date(),
        images: project.gallery.sort((a:any, b:any) => {
            return a.ordering - b.ordering
        }).map((image: any) => image.url),
        importedUrl: url,
        type: type
    }

    content.slug = await makeUniqueSlug(content.slug, convertContentTypeToCollectionName(type))

    // Modrinth keeps versions in a separate endpoint, so we need to fetch them
    // Since projects can have multiple versions, we need to filter out the ones that are not datapacks or resourcepacks
    let vResponse = await fetch(`https://api.modrinth.com/v2/project/${slug}/version?loaders=["minecraft","datapack"]`, {
        headers: {
            'User-Agent': 'MCCreationsOS/mccreations-next (mccreations.net)'
        }
    })
    let versions = await vResponse.json()
    stream.sendUpdate("progress", {message: "Create.Import.Downloading", progress: 60})

    // Transform the modrinth versions into our file format
    content.files = await Promise.all(versions.map(async (version: any): Promise<File | undefined> => {
        if(version.loaders.includes('datapack')) {
            const res = await fetch(version.files[0].url)
            const stream = Readable.fromWeb(res.body as any)
            const url = await uploadFromStream(stream, "files", version.files[0].filename + Date.now(), version.files[0].mime_type)
            return {type: 'data', url: url, minecraftVersion: version.game_versions, contentVersion: version.version_number, createdDate: new Date()}
        } else if (version.loaders.includes('minecraft')) {
            const res = await fetch(version.files[0].url)
            const stream = Readable.fromWeb(res.body as any)
            const url = await uploadFromStream(stream, "files", version.files[0].filename + Date.now(), version.files[0].mime_type)
            return {type: 'resource', url: url, minecraftVersion: version.game_versions, contentVersion: version.version_number, createdDate: new Date()}
        } else {
            return undefined
        }
    }).filter((file: File | undefined): file is File => file !== undefined))

    return content
}