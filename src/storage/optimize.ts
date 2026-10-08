import sharp, { Sharp } from "sharp"
import { Readable } from "stream"

export const OPTIMIZED_EDGE = 1024
export const WEBP_QUALITY = 80

function pipeline(image: Sharp) {
    return image
        .rotate()
        .resize(OPTIMIZED_EDGE, OPTIMIZED_EDGE, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
}

export function optimizeImage(input: Readable) {
    return input.pipe(pipeline(sharp({
        limitInputPixels: 4096 * 4096,
        animated: true,
    })))
}

export function optimizeImageBuffer(input: Buffer, animated = true) {
    return pipeline(sharp(input, {
        limitInputPixels: 4096 * 4096,
        animated,
    })).toBuffer()
}
