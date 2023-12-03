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
import { rateContent } from "./rate.js";
export function initializeCommunityRoutes() {
    app.post('/rate', (req, res) => __awaiter(this, void 0, void 0, function* () {
        let rating = yield rateContent(Number.parseFloat(req.body.rating), req.body.map);
        res.send({ rating: rating });
    }));
    app.post('/maps/rate', (req, res) => __awaiter(this, void 0, void 0, function* () {
        let rating = yield rateContent(Number.parseFloat(req.body.rating), req.body.map);
        res.send({ message: "This route is out of date, please use /rate.", rating: rating });
    }));
    app.post('/maps/comment/:slug', (req, res) => __awaiter(this, void 0, void 0, function* () {
        let database = new Database();
        database.collection.updateOne({ slug: req.params.slug }, { $push: { comments: { username: req.body.username, comment: req.body.comment, date: Date.now(), likes: 0, comments: {} } } });
        res.sendStatus(200);
    }));
}
