/**
 * Optimize images already in the bucket and move them to images/{slug|handle}/,
 * then point creations, users, and file records at the new URLs.
 *
 * Creation gallery images go to images/{slug}/. Profile icons, banners, and
 * other user images go to images/{handle}/. SVGs are moved as-is. Other images
 * are rotated, capped at 1024px, and stored as WebP. Objects already in the
 * right folder and already within that limit are left alone.
 *
 * Dry run (default):
 *   npm run optimize-images
 *   npm run optimize-images -- --limit 10
 *
 * Write to S3 and Mongo, then delete the old objects:
 *   npm run optimize-images -- --apply
 *
 * An apply writes image-migration-log.jsonl in the working directory.
 * Afterwards, refresh search so listings pick up the new image URLs.
 */
import "../env"
import { appendFileSync } from "fs"
import { ObjectId, Document } from "mongodb"
import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3 } from "@aws-sdk/client-s3"
import sharp from "sharp"
import { client } from "../database"
import { OPTIMIZED_EDGE, optimizeImageBuffer } from "../storage/optimize"

const CREATION_COLLECTIONS = ["Maps", "datapacks", "resourcepacks", "marketplace", "blog"]
const URL_PATTERN = /https?:\/\/[^\s"'<>)]+/g
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp|tiff?)$/i
const SVG_EXT = /\.svg$/i
const LOG_PATH = "image-migration-log.jsonl"

type Hit = {
    dbName: "content" | "backend"
    collection: string
    id: ObjectId
    path: string[]
    folder: string | null
    rawUrl: string
}

type PlannedCopy = {
    folder: string
    key: string
    hits: Hit[]
}

type Update = {
    hit: Hit
    newUrl: string
    contentType: string
    filename: string
}

const stats = {
    referenced: 0,
    migrated: 0,
    alreadyOptimized: 0,
    unassigned: 0,
    missing: 0,
    skipped: 0,
    failed: 0,
    unreferenced: 0,
    bytesBefore: 0,
    bytesAfter: 0,
}

async function main() {
    const apply = process.argv.includes("--apply")
    const limit = readLimit()
    const bucketName = process.env.AWS_BUCKET
    if (!bucketName || !process.env.AWS_REGION || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        throw new Error("AWS_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY must be set")
    }
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI must be set")

    sharp.cache(false)
    sharp.concurrency(1)

    const s3 = new S3({
        region: process.env.AWS_REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    })

    console.log(apply
        ? "Applying image migration. Old objects are deleted after their links are updated."
        : "Dry run. Pass --apply to upload optimized images, update the database, and delete the old objects. Apply generates new file ids, so these preview paths will differ.")

    await client.connect()
    try {
        console.log("Scanning creations, users, and file records")
        const hitsByKey = await collectHits(bucketName)
        stats.referenced = hitsByKey.size

        console.log("Listing bucket objects")
        const listed = await listKeys(s3, bucketName)

        const keys = [...hitsByKey.keys()].sort()
        const stopAt = Math.min(limit, keys.length)
        for (let index = 0; index < stopAt; index++) {
            const key = keys[index]
            console.log(`[${index + 1}/${keys.length}] ${key}`)
            await migrateKey(s3, bucketName, key, hitsByKey.get(key) ?? [], apply)
        }

        for (const key of [...listed].sort()) {
            if (!looksLikeImage(key) || hitsByKey.has(key)) continue
            stats.unreferenced++
            console.log(`unreferenced ${key}`)
        }
        if (stopAt < keys.length) {
            console.log(`Stopped after ${stopAt} of ${keys.length} referenced images because of --limit.`)
        }
    } finally {
        await client.close()
    }

    console.log("")
    console.log(`Referenced images: ${stats.referenced}`)
    console.log(`${apply ? "Migrated" : "Would migrate"}: ${stats.migrated}`)
    console.log(`Already optimized: ${stats.alreadyOptimized}`)
    console.log(`No owning creation or user: ${stats.unassigned}`)
    console.log(`Missing from the bucket: ${stats.missing}`)
    console.log(`Skipped: ${stats.skipped}`)
    console.log(`Failed: ${stats.failed}`)
    console.log(`Unreferenced images left in place: ${stats.unreferenced}`)
    console.log(`Size: ${formatBytes(stats.bytesBefore)} original, ${formatBytes(stats.bytesAfter)} uploaded`)
    if (apply) console.log("Refresh search so listings pick up the new image URLs.")
    if (stats.failed > 0) process.exitCode = 1
}

async function migrateKey(s3: S3, bucketName: string, key: string, hits: Hit[], apply: boolean) {
    const scoped = hits.filter(hit => hit.folder)
    if (scoped.length === 0) {
        stats.unassigned++
        console.log(`no owner for ${key}`)
        return "unassigned"
    }

    let response
    try {
        response = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: key }))
    } catch (error) {
        if (isMissing(error)) {
            stats.missing++
            console.log(`missing ${key}`)
            return "missing"
        }
        stats.failed++
        console.error(`failed to download ${key}: ${errorMessage(error)}`)
        return "failed"
    }

    if (!response.Body) {
        stats.missing++
        console.log(`missing ${key}`)
        return "missing"
    }

    const contentType = response.ContentType ?? ""
    const svg = contentType.includes("svg") || SVG_EXT.test(key)
    if (!svg && !contentType.startsWith("image/") && !IMAGE_EXT.test(key)) {
        stats.skipped++
        console.log(`skip ${key}: ${contentType || "unknown type"}`)
        return "skipped"
    }

    const buffer = Buffer.from(await response.Body.transformToByteArray())
    let settled = svg
    if (!svg) {
        try {
            const meta = await sharp(buffer, { animated: true, limitInputPixels: 4096 * 4096 }).metadata()
            const width = meta.width ?? Number.POSITIVE_INFINITY
            const height = meta.height ?? Number.POSITIVE_INFINITY
            settled = meta.format === "webp" && width <= OPTIMIZED_EDGE && height <= OPTIMIZED_EDGE
        } catch (error) {
            console.warn(`could not read ${key}: ${errorMessage(error)}`)
        }
    }

    const copies = new Map<string, Hit[]>()
    let keepOriginal = false
    for (const hit of scoped) {
        if (settled && isInFolder(key, hit.folder!)) {
            keepOriginal = true
            continue
        }
        const group = copies.get(hit.folder!) ?? []
        group.push(hit)
        copies.set(hit.folder!, group)
    }

    if (copies.size === 0) {
        stats.alreadyOptimized++
        console.log(`already in place ${key}`)
        return "already-optimized"
    }

    let body = buffer
    const outputType = svg ? (contentType || "image/svg+xml") : "image/webp"
    if (!svg && !settled) {
        try {
            body = await encodeWebp(buffer)
        } catch (error) {
            stats.failed++
            console.error(`failed to optimize ${key}: ${errorMessage(error)}`)
            return "failed"
        }
    }

    const filename = outputName(key, svg)
    const uploaded: PlannedCopy[] = []
    try {
        for (const [folder, folderHits] of copies) {
            const newKey = `images/${folder}/${filename}`
            if (apply) {
                await s3.send(new PutObjectCommand({
                    Bucket: bucketName,
                    Key: newKey,
                    Body: body,
                    ContentType: outputType,
                }))
            }
            uploaded.push({ folder, key: newKey, hits: folderHits })
            console.log(`${apply ? "moved" : "would move"} ${key} -> ${newKey} (${formatBytes(buffer.length)} -> ${formatBytes(body.length)})`)
            for (const hit of folderHits) {
                console.log(`  ${hit.dbName}.${hit.collection} ${hit.id.toHexString()} ${hit.path.join(".")}`)
            }
        }

        const updates = updatesFor(bucketName, uploaded, hits.filter(hit => !hit.folder), keepOriginal, outputType, filename)
        if (apply) {
            await applyUpdates(updates)
            let deleted = false
            if (!keepOriginal && !uploaded.some(copy => copy.key === key)) {
                try {
                    await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }))
                    deleted = true
                } catch (error) {
                    console.error(`updated links for ${key} but could not delete it: ${errorMessage(error)}`)
                }
            }
            appendFileSync(LOG_PATH, JSON.stringify({
                at: new Date().toISOString(),
                oldKey: key,
                deleted,
                copies: uploaded.map(copy => ({ folder: copy.folder, key: copy.key })),
                documents: updates.map(update => ({
                    db: update.hit.dbName,
                    collection: update.hit.collection,
                    id: update.hit.id.toHexString(),
                    path: update.hit.path.join("."),
                })),
            }) + "\n")
        }
    } catch (error) {
        stats.failed++
        console.error(`failed while publishing ${key}: ${errorMessage(error)}`)
        if (apply && uploaded.length > 0) {
            console.error(`new objects left in place: ${uploaded.map(copy => copy.key).join(", ")}`)
        }
        return "failed"
    }

    stats.migrated++
    stats.bytesBefore += buffer.length
    stats.bytesAfter += body.length * uploaded.length
    return apply ? "migrated" : "dry-run"
}

function updatesFor(bucketName: string, uploaded: PlannedCopy[], unscoped: Hit[], keepOriginal: boolean, contentType: string, filename: string) {
    const updates: Update[] = []
    for (const copy of uploaded) {
        for (const hit of copy.hits) {
            updates.push({
                hit,
                newUrl: urlForKey(hit.rawUrl, bucketName, copy.key),
                contentType,
                filename,
            })
        }
    }
    if (!keepOriginal && uploaded.length > 0) {
        if (uploaded.length > 1 && unscoped.length > 0) {
            console.log(`  records without their own folder will point at images/${uploaded[0].folder}/`)
        }
        for (const hit of unscoped) {
            updates.push({
                hit,
                newUrl: urlForKey(hit.rawUrl, bucketName, uploaded[0].key),
                contentType,
                filename,
            })
        }
    }
    return updates
}

async function applyUpdates(updates: Update[]) {
    const groups = new Map<string, Update[]>()
    for (const update of updates) {
        const id = `${update.hit.dbName}:${update.hit.collection}:${update.hit.id.toHexString()}`
        const group = groups.get(id) ?? []
        group.push(update)
        groups.set(id, group)
    }

    for (const group of groups.values()) {
        const first = group[0].hit
        const collection = client.db(first.dbName).collection(first.collection)
        const doc = await collection.findOne({ _id: first.id })
        if (!doc) {
            console.warn(`missing ${first.dbName}.${first.collection} ${first.id.toHexString()}`)
            continue
        }

        const $set: Record<string, unknown> = {}
        const rewritten = new Map<string, string>()
        const ordered = [...group].sort((a, b) => b.hit.rawUrl.length - a.hit.rawUrl.length)
        for (const update of ordered) {
            const pathKey = update.hit.path.join(".")
            let current = rewritten.get(pathKey)
            if (current === undefined) {
                const value = getAtPath(doc, update.hit.path)
                if (typeof value !== "string") continue
                current = value
            }
            rewritten.set(pathKey, replaceUrl(current, update.hit.rawUrl, update.newUrl))
        }
        for (const [pathKey, next] of rewritten) {
            if (getAtPath(doc, pathKey.split(".")) !== next) $set[pathKey] = next
        }

        const locationUpdate = group.find(update => update.hit.path[update.hit.path.length - 1] === "location")
        if (first.collection === "files" && locationUpdate?.contentType === "image/webp") {
            $set.mimetype = "image/webp"
            if (typeof doc.type === "string" && doc.type.startsWith("image/")) $set.type = "image/webp"
            if (typeof doc.filename === "string") $set.filename = locationUpdate.filename
            if (typeof doc.name === "string") $set.name = locationUpdate.filename
        }

        if (Object.keys($set).length === 0) continue
        const result = await collection.updateOne({ _id: first.id }, { $set })
        if (!result.acknowledged) {
            throw new Error(`update not acknowledged for ${first.collection} ${first.id.toHexString()}`)
        }
    }
}

async function collectHits(bucketName: string) {
    const hitsByKey = new Map<string, Hit[]>()
    const seen = new Set<string>()
    const userFolders = new Map<string, string>()

    function add(key: string, hit: Hit) {
        if (hit.path.some(part => part.includes(".") || part.startsWith("$"))) {
            console.warn(`skipping ${hit.collection} ${hit.id.toHexString()} ${hit.path.join(".")}: unsupported path`)
            return
        }
        const dedupe = `${hit.dbName}:${hit.collection}:${hit.id.toHexString()}:${hit.path.join(".")}:${hit.rawUrl}`
        if (seen.has(dedupe)) return
        seen.add(dedupe)
        const list = hitsByKey.get(key) ?? []
        list.push(hit)
        hitsByKey.set(key, list)
    }

    function consider(dbName: Hit["dbName"], collection: string, id: ObjectId, path: string[], rawUrl: string, folder: string | null) {
        const key = extractKey(rawUrl, bucketName)
        if (!key) return
        if (!isDirectImageField(path) && !looksLikeImage(key)) return
        add(key, { dbName, collection, id, path, folder, rawUrl })
    }

    const creators = client.db("content").collection("creators")
    for await (const doc of creators.find({})) {
        if (!(doc._id instanceof ObjectId)) continue
        const folder = userFolder(doc)
        if (folder) userFolders.set(doc._id.toHexString(), folder)
        walk(doc, [], (path, value) => {
            for (const rawUrl of value.match(URL_PATTERN) ?? []) {
                consider("content", "creators", doc._id, path, rawUrl, folder)
            }
        })
    }

    for (const collectionName of CREATION_COLLECTIONS) {
        const collection = client.db("content").collection(collectionName)
        for await (const doc of collection.find({})) {
            if (!(doc._id instanceof ObjectId)) continue
            walk(doc, [], (path, value) => {
                const folder = folderForCreation(doc, path, userFolders)
                for (const rawUrl of value.match(URL_PATTERN) ?? []) {
                    consider("content", collectionName, doc._id, path, rawUrl, folder)
                }
            })
        }
    }

    const files = client.db("backend").collection("files")
    for await (const doc of files.find({})) {
        if (!(doc._id instanceof ObjectId)) continue
        walk(doc, [], (path, value) => {
            for (const rawUrl of value.match(URL_PATTERN) ?? []) {
                consider("backend", "files", doc._id, path, rawUrl, null)
            }
        })
    }

    return hitsByKey
}

function folderForCreation(doc: Document, path: string[], userFolders: Map<string, string>) {
    if (path[0] === "creators" && path.length >= 2) {
        const creator = Array.isArray(doc.creators) ? doc.creators[Number(path[1])] : undefined
        if (creator && typeof creator === "object") {
            const folder = creatorFolder(creator as Document, userFolders)
            if (folder) return folder
        }
    }
    return folderName(doc.slug)
}

function creatorFolder(creator: Document, userFolders: Map<string, string>) {
    const id = creator._id instanceof ObjectId ? creator._id.toHexString() : undefined
    if (id && userFolders.has(id)) return userFolders.get(id) ?? null
    return folderName(creator.handle) || folderName(typeof creator.username === "string" ? slugify(creator.username) : null)
}

function userFolder(user: Document) {
    return folderName(user.handle) || folderName(typeof user.username === "string" ? slugify(user.username) : null)
}

function folderName(value: unknown) {
    if (typeof value !== "string") return null
    const folder = value.trim()
    if (!folder || folder.includes("/") || folder.includes("\\") || folder.includes("..")) return null
    return folder
}

function slugify(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, "-")
}

function walk(value: unknown, path: string[], visit: (path: string[], value: string) => void) {
    if (typeof value === "string") {
        visit(path, value)
        return
    }
    if (Array.isArray(value)) {
        value.forEach((item, index) => walk(item, [...path, String(index)], visit))
        return
    }
    if (!isPlain(value)) return
    for (const [key, child] of Object.entries(value)) {
        walk(child, [...path, key], visit)
    }
}

function isPlain(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false
    if (value instanceof Date || Buffer.isBuffer(value)) return false
    if ("_bsontype" in value) return false
    return true
}

function isDirectImageField(path: string[]) {
    const field = path[path.length - 1]
    return field === "iconURL" || field === "bannerURL" || (path[0] === "images" && path.length === 2)
}

function looksLikeImage(key: string) {
    return IMAGE_EXT.test(key) || SVG_EXT.test(key)
}

function isInFolder(key: string, folder: string) {
    const prefix = `images/${folder}/`
    if (!key.startsWith(prefix)) return false
    const rest = key.slice(prefix.length)
    return rest.length > 0 && !rest.includes("/")
}

function extractKey(rawUrl: string, bucketName: string) {
    const parsed = parseUrl(rawUrl)
    if (!parsed) return null
    let path = parsed.pathname.replace(/^\/+/, "")
    try {
        path = decodeURIComponent(path)
    } catch {
        // Keep the raw path when it contains a stray %.
    }
    if (parsed.hostname.startsWith(`${bucketName}.s3`)) return path || null
    if (parsed.hostname.includes("amazonaws.com") && (path === bucketName || path.startsWith(`${bucketName}/`))) {
        const key = path.slice(bucketName.length).replace(/^\//, "")
        return key || null
    }
    return null
}

function parseUrl(rawUrl: string) {
    try {
        return new URL(rawUrl)
    } catch {
        try {
            return new URL(rawUrl.replace(/ /g, "%20"))
        } catch {
            return null
        }
    }
}

function urlForKey(sampleUrl: string, bucketName: string, key: string) {
    const encodedKey = key.split("/").map(segment => encodeURIComponent(segment)).join("/")
    const parsed = parseUrl(sampleUrl)
    if (parsed?.hostname.startsWith(`${bucketName}.`)) {
        return `${parsed.protocol}//${parsed.host}/${encodedKey}`
    }
    if (parsed?.hostname.includes("amazonaws.com")) {
        return `${parsed.protocol}//${parsed.host}/${bucketName}/${encodedKey}`
    }
    return `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${encodedKey}`
}

function outputName(key: string, svg: boolean) {
    const base = key.split("/").pop() || "image"
    if (svg) return `${crypto.randomUUID()}-${base}`
    const stem = base.replace(/\.[^.]+$/, "") || "image"
    return `${crypto.randomUUID()}-${stem}.webp`
}

function replaceUrl(value: string, rawUrl: string, newUrl: string) {
    return value.replace(new RegExp(escapeRegExp(rawUrl) + "(?![A-Za-z0-9._~-])", "g"), newUrl)
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function getAtPath(doc: Record<string, unknown>, path: string[]) {
    let current: unknown = doc
    for (const part of path) {
        if (!current || typeof current !== "object") return undefined
        current = (current as Record<string, unknown>)[part]
    }
    return current
}

async function listKeys(s3: S3, bucketName: string) {
    const keys = new Set<string>()
    let token: string | undefined
    do {
        const page = await s3.send(new ListObjectsV2Command({
            Bucket: bucketName,
            ContinuationToken: token,
        }))
        for (const object of page.Contents ?? []) {
            if (object.Key) keys.add(object.Key)
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined
    } while (token)
    return keys
}

async function encodeWebp(buffer: Buffer) {
    try {
        return await optimizeImageBuffer(buffer, true)
    } catch (error) {
        console.warn(`animated encode failed, using the first frame: ${errorMessage(error)}`)
        return optimizeImageBuffer(buffer, false)
    }
}

function readLimit() {
    const inline = process.argv.find(arg => arg.startsWith("--limit="))
    const value = inline ? inline.slice("--limit=".length) : valueAfter("--limit")
    if (!value) return Number.POSITIVE_INFINITY
    const limit = Number(value)
    if (!Number.isInteger(limit) || limit < 0) throw new Error("--limit must be a non-negative integer")
    return limit
}

function valueAfter(flag: string) {
    const index = process.argv.indexOf(flag)
    if (index < 0) return undefined
    return process.argv[index + 1]
}

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function isMissing(error: unknown) {
    return !!error && typeof error === "object" && "name" in error && (error.name === "NoSuchKey" || error.name === "NotFound")
}

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error)
}

main().catch(error => {
    console.error(error)
    process.exitCode = 1
})
