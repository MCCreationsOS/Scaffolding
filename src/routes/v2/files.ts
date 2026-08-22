import { TVoid } from "@sinclair/typebox"
import { ObjectId } from "mongodb"
import { processAuthorizationHeader } from "../../auth/user"
import { Database } from "../../database"
import { FileDocument } from "../../database/models/files"
import { AuthorizationHeader } from "../../schemas/auth"
import { FileUpdate, TFile } from "../../schemas/file"
import { GenericResponseType, WithCount } from "../../schemas/generic"
import { UserType, UserTypes } from "../../schemas/user"
import { downloadFile } from "../../storage"
import { Router } from "../router"

const WithCountFile = WithCount(TFile)

function canModifyFile(file: FileDocument, user: UserType): boolean {
    if (user.type === UserTypes.Admin) return true
    if (!file.user) return false

    const fileUserId = typeof file.user === "object" && file.user !== null && "_id" in file.user
        ? file.user._id?.toString()
        : file.user.toString()

    return fileUserId === user._id.toString()
}

Router.app.get<{
    Querystring: {
        limit?: string
        page?: string
        user?: string
    }
    Reply: GenericResponseType<typeof WithCountFile>
}>("/files", async (req, res) => {
    const database = new Database<FileDocument>("backend", "files")
    const limit = parseInt(req.query.limit ?? "20")
    const page = parseInt(req.query.page ?? "0")

    const query: Record<string, unknown> = {}
    if (req.query.user) {
        query.user = req.query.user
    }

    const [documents, totalCount] = await Promise.all([
        database.find(query, limit, page * limit, { _id: -1 }),
        database.countDocuments(query)
    ])

    return res.status(200).send({
        totalCount,
        documents
    })
})

Router.app.get<{
    Params: {
        id: string
    }
    Reply: GenericResponseType<typeof TFile>
}>("/file/:id", async (req, res) => {
    const database = new Database<FileDocument>("backend", "files")

    let id: ObjectId
    try {
        id = new ObjectId(req.params.id)
    } catch {
        return res.status(400).send({ error: "Invalid file id" })
    }

    const file = await database.findOne({ _id: id })
    if (!file) {
        return res.status(404).send({ error: "File not found" })
    }

    return res.status(200).send(file)
})

Router.app.get<{
    Params: {
        id: string
    }
}>("/file/:id/download", async (req, res) => {
    const database = new Database<FileDocument>("backend", "files")

    let id: ObjectId
    try {
        id = new ObjectId(req.params.id)
    } catch {
        return res.status(400).send({ error: "Invalid file id" })
    }

    const file = await database.findOne({ _id: id })
    if (!file) {
        return res.status(404).send({ error: "File not found" })
    }

    try {
        const data = await downloadFile(file.location)
        const filename = file.filename ?? file.name ?? "download"
        const mimetype = file.mimetype ?? file.type ?? "application/octet-stream"

        return res
            .header("Content-Type", mimetype)
            .header("Content-Disposition", `attachment; filename="${filename}"`)
            .send(Buffer.from(data))
    } catch {
        return res.status(502).send({ error: "Failed to download file" })
    }
})

Router.app.put<{
    Params: {
        id: string
    }
    Body: FileUpdate
    Reply: GenericResponseType<typeof TFile>
    Headers: AuthorizationHeader
}>("/file/:id", async (req, res) => {
    const user = await processAuthorizationHeader(req.headers.authorization + "")
    if (!user) {
        return res.status(401).send({ error: "Unauthorized" })
    }

    const database = new Database<FileDocument>("backend", "files")

    let id: ObjectId
    try {
        id = new ObjectId(req.params.id)
    } catch {
        return res.status(400).send({ error: "Invalid file id" })
    }

    const file = await database.findOne({ _id: id })
    if (!file) {
        return res.status(404).send({ error: "File not found" })
    }

    if (!canModifyFile(file, user)) {
        return res.status(401).send({ error: "Unauthorized" })
    }

    const update: Partial<FileDocument> = {}
    if (req.body.filename !== undefined) update.filename = req.body.filename
    if (req.body.name !== undefined) update.name = req.body.name
    if (req.body.mimetype !== undefined) update.mimetype = req.body.mimetype
    if (req.body.type !== undefined) update.type = req.body.type

    if (Object.keys(update).length === 0) {
        return res.status(400).send({ error: "No fields to update" })
    }

    await database.updateOne({ _id: id }, { $set: update })

    const updated = await database.findOne({ _id: id })
    return res.status(200).send(updated!)
})

Router.app.delete<{
    Params: {
        id: string
    }
    Reply: GenericResponseType<TVoid>
    Headers: AuthorizationHeader
}>("/file/:id", async (req, res) => {
    const user = await processAuthorizationHeader(req.headers.authorization + "")
    if (!user) {
        return res.status(401).send({ error: "Unauthorized" })
    }

    const database = new Database<FileDocument>("backend", "files")

    let id: ObjectId
    try {
        id = new ObjectId(req.params.id)
    } catch {
        return res.status(400).send({ error: "Invalid file id" })
    }

    const file = await database.findOne({ _id: id })
    if (!file) {
        return res.status(404).send({ error: "File not found" })
    }

    if (!canModifyFile(file, user)) {
        return res.status(401).send({ error: "Unauthorized" })
    }

    await database.deleteOne({ _id: id })
    return res.status(200).send({})
})
