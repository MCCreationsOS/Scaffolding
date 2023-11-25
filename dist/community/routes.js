var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { app } from "../index.js";
import { Database } from "../db/connect.js";
export function initializeCommunityRoutes() {
    app.post('/maps/rate/:slug', (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        let database = new Database();
        let map = req.body.map;
        // Calculate new rating
        let rating = 0;
        let ratings = map.ratings;
        let rates = 1;
        if (ratings) {
            rates = map.ratings.length + 1;
            ratings.push(Number.parseFloat(req.body.rating));
        }
        else {
            ratings = [Number.parseFloat(req.body.rating)];
        }
        for (let i = 0; i < rates; i++) {
            rating += ratings[i];
        }
        rating = rating / (rates + 0.0);
        database.collection.updateOne({ slug: map.slug }, { $push: { ratings: Number.parseFloat(req.body.rating) }, $set: { rating: rating } }).then(() => {
            res.send({ rating: rating });
        }).catch((error) => {
            console.error(error);
            res.sendStatus(500);
        });
    }));
    app.post('/maps/comment/:slug', (req, res) => __awaiter(this, void 0, void 0, function* () {
        let database = new Database();
        database.collection.updateOne({ slug: req.params.slug }, { $push: { comments: { username: req.body.username, comment: req.body.comment, date: Date.now(), likes: 0, comments: {} } } });
        res.sendStatus(200);
    }));
}
