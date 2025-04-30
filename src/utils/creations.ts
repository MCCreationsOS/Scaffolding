import { Duplex } from "stream";
import { Creation } from "../schemas/creation";

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