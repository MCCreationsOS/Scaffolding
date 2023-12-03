import { Database } from "../db/connect.js";
export function rateContent(rating, content) {
    let database = new Database();
    let totalRating = 0;
    if (content.ratings) {
        content.ratings.push(rating);
    }
    else {
        content.ratings = [rating];
    }
    for (let i = 0; i < content.ratings.length; i++) {
        totalRating += content.ratings[i];
    }
    totalRating = totalRating / content.ratings.length;
    database.collection.updateOne({ slug: content.slug }, { $push: { ratings: rating }, $set: { rating: totalRating } }).then(() => {
        return totalRating;
    }).catch((error) => {
        console.error(error);
        return -1;
    });
}
