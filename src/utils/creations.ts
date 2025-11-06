import { Duplex } from "stream";
import { Creation } from "../schemas/creation";
import { UserType, UserTypes } from "../schemas/user";
import { getIdFromJWT, processAuthorizationHeader } from "../auth/user";
import { ObjectId } from "mongodb";

export function createDefaultCreation(creation: Creation): Creation {
    return {
        ...creation,
        createdDate: Date.now(),
        updatedDate: Date.now(),
        views: 0,
        downloads: 0,
        rating: 0,
        files: [],
        images: [],
        ratings: [],
        tags: [],
        videoUrl: "",
        creators: [],
        slug: "",
        extraFeatures: {
            leaderboards: {
                use: false
            }
        },
        status: 0,
        owner: undefined
    }
}

export class ProgressStream extends Duplex {
    constructor() {
        super()
    }

    sendUpdate(type: 'progress' | 'error' | 'complete', data: any) {
        this.push(JSON.stringify({
            type,
            timestamp: new Date().toISOString(),
            data
        }))
    }

    _read() {}

    _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
        this.push(chunk)
        callback()
    }
}

export async function authorizedToEdit(creation: Creation, authorization: string) {
    let user = await processAuthorizationHeader(authorization)
    if (!user) {
        return false
    }
    let ignoreOwnerOrCreator = false
    if (!user) {
        let key = getIdFromJWT(authorization)
        if (!key) {
            return false
        } else if (key instanceof ObjectId && !key.equals(creation?._id)) {
            return false
        } else {
            ignoreOwnerOrCreator = true
        }
    } else if (user && user.type === UserTypes.Admin) {
        ignoreOwnerOrCreator = true
    }

    if (!ignoreOwnerOrCreator) {
        if (creation.owner !== user?.handle && creation.creators.filter(creator => creator.handle === user?.handle).length === 0) {
            return false
        }
    }

    return true
}