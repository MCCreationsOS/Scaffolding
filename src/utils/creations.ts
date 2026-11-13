import { Duplex } from "stream";
import { Creation } from "../schemas/creation";
import { UserType, UserTypes } from "../schemas/user";
import { getIdFromJWT, processAuthorizationHeader } from "../auth/user";
import { ObjectId } from "mongodb";
import { env } from "../env";

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

export async function authorizedToEdit(creation: Creation, authorization?: string) {
    if (!authorization || !creation) {
        return false
    }

    let user: UserType | undefined | null = undefined
    try {
        user = await processAuthorizationHeader(authorization)
    } catch (e) {
        user = undefined
    }

    if (!user) {
        // People without an account edit with the creation key issued when the creation was uploaded.
        // The key is a JWT whose _id is the creation's _id, so it only unlocks that one creation.
        const key = getIdFromJWT(authorization)
        return !!key && !!creation._id && key.equals(creation._id)
    }

    if (user.type === UserTypes.Admin) {
        return true
    }

    return creation.owner === user.handle || (creation.creators ?? []).some(creator => creator.handle === user!.handle)
}

/**
 * Tell the frontend to drop its cached copy of a tag. Requires REVALIDATE_SECRET to match the frontend's.
 */
export async function revalidateFrontend(tag: string) {
    if (!env.REVALIDATE_SECRET) {
        console.warn("REVALIDATE_SECRET is not set; skipping frontend revalidation for", tag)
        return
    }
    try {
        await fetch(`${env.FRONTEND_URL}/api/cache/revalidate?tag=${encodeURIComponent(tag)}`, {
            headers: { "x-revalidate-secret": env.REVALIDATE_SECRET }
        })
    } catch (e) {
        console.error("Failed to revalidate frontend tag", tag, e)
    }
}
