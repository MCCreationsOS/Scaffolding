import { ObjectId } from "mongodb"

export type FileDocument = {
    _id: ObjectId
    filename?: string
    name?: string
    mimetype?: string
    type?: string
    location: string
    user?: ObjectId | string | { id?: string, _id?: ObjectId }
}
