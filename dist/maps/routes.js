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
import { app } from '../index.js';
import { Database, DatabaseQueryBuilder } from '../db/connect.js';
export function initializeMapRoutes() {
    app.get('/maps', (req, res) => __awaiter(this, void 0, void 0, function* () {
        let result = yield findMaps(req.query);
        if (req.query.sendCount && req.query.sendCount === "true") {
            res.send({ count: result.totalCount });
        }
        else {
            res.send(result);
        }
    }));
    app.get('/maps/:slug', (req, res) => __awaiter(this, void 0, void 0, function* () {
        let result = yield findMaps({ limit: 1, slug: req.params.slug });
        res.send(result.documents[0]);
    }));
}
function findMaps(requestQuery) {
    var _a, e_1, _b, _c;
    return __awaiter(this, void 0, void 0, function* () {
        let database = new Database();
        let query = new DatabaseQueryBuilder();
        switch (requestQuery.sort) {
            case "newest":
                query.buildSort("createdDate", -1);
                break;
            case "updated":
                query.buildSort("updatedDate", -1);
                break;
            case "title_ascending":
                query.buildSort("title", 1);
                break;
            case "title_descending":
                query.buildSort("title", -1);
                break;
            case "oldest":
                query.buildSort("createdDate", 1);
                break;
            case "highest_rated":
                query.buildSort("rating", -1);
                break;
            case "lowest_rated":
                query.buildSort("rating", 1);
                break;
            case "creator_ascending":
                query.buildSort("creators.username", 1);
                break;
            case "creator_descending":
                query.buildSort("creators.username", -1);
                break;
            // case "best_match": 
            // 	sort = {score: {$meta: "textScore"}}
            // 	break;
            default:
                query.buildSort("createdDate", -1);
        }
        if (requestQuery.status) {
            query.buildQueryWithOperation("status", Number.parseInt(requestQuery.status), "$gte");
        }
        else {
            query.buildQueryWithOperation("status", 2, "$gte");
        }
        if (requestQuery.version) {
            requestQuery.version.replace(".0", "");
            query.buildQuery("files.minecraftVersion", requestQuery.version);
        }
        if (requestQuery.search && requestQuery.search.length > 3 && !(requestQuery.search === "undefined" || requestQuery.search === "null")) {
            query.buildQueryWithOperation("$text", requestQuery.search, "$search");
        }
        if (requestQuery.slug) {
            query.buildQuery("slug", requestQuery.slug);
        }
        if (requestQuery.limit) {
            query.setLimit(Number.parseInt(requestQuery.limit));
        }
        if (requestQuery.skip) {
            if (requestQuery.skip < 0) {
                requestQuery.skip = "0";
            }
            query.setSkip(Number.parseInt(requestQuery.skip));
        }
        const projection = {
            _id: 0,
            title: 1,
            // score: { $meta: "textScore" },
            "files.minecraftVersion": 1,
            shortDescription: 1,
            downloads: 1,
            rating: 1,
            "creators.username": 1,
            images: 1,
            slug: 1
        };
        query.setProjection(projection);
        let count = yield database.collection.countDocuments(query.query);
        let cursor = database.executeQuery(query);
        let documents = [];
        try {
            for (var _d = true, cursor_1 = __asyncValues(cursor), cursor_1_1; cursor_1_1 = yield cursor_1.next(), _a = cursor_1_1.done, !_a; _d = true) {
                _c = cursor_1_1.value;
                _d = false;
                const doc = _c;
                documents.push(doc);
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
        return result;
    });
}
