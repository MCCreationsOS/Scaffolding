import { User } from "../auth/types.js";
import { Database } from "../db/connect.js";
import { ContentDocument } from "../db/types.js";
import { sendLog } from "../logging/logging.js";
import { createNotification, createNotificationToCreators } from "../notifications/index.js";

export function rateContent(rating: number, content: ContentDocument) {
    let database = new Database();

    switch(content.type) {
        case "map":
            database = new Database("content", "Maps")
            break;
        case "datapack":
            database = new Database("content", "datapacks")
            break;
        case "resourcepack":
            database = new Database("content", "resourcepacks")
            break;
    }

    let totalRating = 0;
    if(content.ratings) {
        content.ratings.push(rating)
    } else {
        content.ratings = [rating];
    }

    for(let i = 0; i < content.ratings.length; i++) {
        totalRating += content.ratings[i];
    }

    totalRating = totalRating/content.ratings.length
    database.collection.updateOne({slug: content.slug}, {$push: {ratings: rating}, $set : {rating: totalRating}}).then(() => {
        return totalRating
    }).catch((error: any) => {
        sendLog("rateContent", error)
        console.error(error)
        return -1;
    })

    createNotificationToCreators({
        content: content,
        type: "rating",
        title: {key: "Account.Notifications.NewRating.title"},
        body: {key: "Account.Notifications.NewRating.body", options: {type: content.type, rating: rating, title: content.title}}
    })
}