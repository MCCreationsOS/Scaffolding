var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
import { app } from "../index.js";
import { Database, DatabaseQueryBuilder } from "../db/connect.js";
import { rateContent } from "./rate.js";
import * as words from 'naughty-words';
export function initializeCommunityRoutes() {
    app.get('/creators', (req, res) => __awaiter(this, void 0, void 0, function* () {
        var _a, e_1, _b, _c;
        let database = new Database('content', 'creators');
        let query = new DatabaseQueryBuilder();
        query.setProjection({
            password: 0,
            providers: 0
        });
        let cursor = yield database.executeQuery(query);
        let documents = [];
        let count = 0;
        try {
            for (var _d = true, cursor_1 = __asyncValues(cursor), cursor_1_1; cursor_1_1 = yield cursor_1.next(), _a = cursor_1_1.done, !_a; _d = true) {
                _c = cursor_1_1.value;
                _d = false;
                const doc = _c;
                documents.push(doc);
                count++;
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_d && !_a && (_b = cursor_1.return)) yield _b.call(cursor_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        let result = {
            totalCount: count,
            documents: documents
        };
        res.send(result);
    }));
    app.get('/creator/:handle', (req, res) => __awaiter(this, void 0, void 0, function* () {
        let database = new Database('content', 'creators');
        let query = new DatabaseQueryBuilder();
        query.buildQuery("handle", req.params.handle);
        query.setProjection({
            password: 0,
            providers: 0,
            email: 0
        });
        let cursor = yield database.executeQuery(query);
        res.send(yield cursor.next());
    }));
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
        let comments = new Database("content", "comments");
        let approved = true;
        if (words.en.some((word) => req.body.comment.includes(word))) {
            approved = false;
        }
        let comment = yield comments.collection.insertOne({ username: req.body.username, comment: req.body.comment, date: Date.now(), likes: 0, handle: req.body.handle, approved: approved });
        database.collection.updateOne({ slug: req.params.slug }, { $push: { comments: { _id: comment.insertedId, username: req.body.username, comment: req.body.comment, date: Date.now(), likes: 0, handle: req.body.handle, approved: approved } } });
        res.sendStatus(200);
    }));
}
