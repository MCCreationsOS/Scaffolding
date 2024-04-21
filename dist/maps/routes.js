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
import { Database, DatabaseQueryBuilder, Search } from '../db/connect.js';
import { getIdFromJWT, getUserFromJWT } from '../auth/routes.js';
import { ObjectId } from 'mongodb';
import { sendLog } from '../logging/logging.js';
export function initializeMapRoutes() {
    app.get('/maps', (req, res) => __awaiter(this, void 0, void 0, function* () {
        let result = yield performSearch(req.query);
        let user = yield getUserFromJWT(req.headers.authorization + "");
        result.documents = result.documents.filter((map) => {
            if (map.status < 2) {
                if (user.user && map.creators) {
                    for (const creator of map.creators) {
                        if (creator.handle === user.user.handle)
                            return true;
                    }
                }
                else {
                    let id = getIdFromJWT(req.headers.authorization + "");
                    if (id && id instanceof ObjectId && id.equals(map._id)) {
                        return true;
                    }
                }
                return false;
            }
            return true;
        });
        if (req.query.sendCount && req.query.sendCount === "true") {
            res.send({ count: result.totalCount });
        }
        else {
            res.send(result);
        }
    }));
    app.get('/old/maps', (req, res) => __awaiter(this, void 0, void 0, function* () {
        let result = yield findMaps(req.query, false);
        let user = yield getUserFromJWT(req.headers.authorization + "");
        result.documents = result.documents.filter((map) => {
            if (map.status < 2) {
                if (user.user && map.creators) {
                    for (const creator of map.creators) {
                        if (creator.handle === user.user.handle)
                            return true;
                    }
                }
                else {
                    let id = getIdFromJWT(req.headers.authorization + "");
                    if (id && id instanceof ObjectId && id.equals(map._id)) {
                        return true;
                    }
                }
                return false;
            }
            return true;
        });
        if (req.query.sendCount && req.query.sendCount === "true") {
            res.send({ count: result.totalCount });
        }
        else {
            res.send(result);
        }
    }));
    app.get('/maps/:slug', (req, res) => __awaiter(this, void 0, void 0, function* () {
        let result = yield findMaps({ limit: 1, slug: req.params.slug }, false);
        if (result.documents[0] && result.documents[0].status < 1) {
            let filter = true;
            if (req.headers.authorization) {
                let uObj = yield getUserFromJWT(req.headers.authorization);
                if (uObj.user && result.documents[0].creators) {
                    for (const creator of result.documents[0].creators) {
                        if (creator.handle === uObj.user.handle)
                            filter = false;
                    }
                    if (uObj.user.handle === "crazycowmm")
                        filter = false;
                }
                else {
                    let id = getIdFromJWT(req.headers.authorization);
                    if (id && id instanceof ObjectId && id.equals(result.documents[0]._id)) {
                        filter = false;
                    }
                }
            }
            if (filter) {
                res.send({ error: "Map does not exist, or you do not have permission to view it" });
                return;
            }
        }
        if (result.documents.length !== 1) {
            res.send({ error: "Map does not exist, or you do not have permission to view it" });
            return;
        }
        res.send(result.documents[0]);
    }));
    app.get('/maps/:slug/download', (req, res) => __awaiter(this, void 0, void 0, function* () {
        let result = yield findMaps({ limit: 1, slug: req.params.slug }, false);
        if (result.documents[0]) {
            let map = result.documents[0];
            let database = new Database();
            database.collection.updateOne({ _id: map._id }, { $inc: { downloads: 1 } });
            res.sendStatus(200);
            return;
        }
        res.sendStatus(404);
    }));
    app.get('/maps/:slug/comments', (req, res) => __awaiter(this, void 0, void 0, function* () {
        let result = yield findMaps({ limit: 1, slug: req.params.slug }, false);
        if (result.documents[0]) {
            let map = result.documents[0];
            res.send({ comments: map.comments });
            return;
        }
        res.sendStatus(404);
    }));
    app.get('/maps/:slug/stats', (req, res) => __awaiter(this, void 0, void 0, function* () {
        let result = yield findMaps({ limit: 1, slug: req.params.slug }, false);
        if (result.documents[0]) {
            let map = result.documents[0];
            res.send({ downloads: map.downloads, ratings: map.ratings, rating: map.rating, views: map.views });
            return;
        }
        res.sendStatus(404);
    }));
    app.get('/get_map_tags', (req, res) => __awaiter(this, void 0, void 0, function* () {
        res.send({
            genre: [
                "adventure",
                "parkour",
                "survival",
                "puzzle",
                "game",
                "build"
            ],
            subgenre: [
                "horror",
                "PVE",
                "PVP",
                "episodic",
                "challenge",
                'CTM',
                "RPG",
                "trivia",
                "escape",
                "finding",
                "maze",
                "unfair",
                "dropper",
                "elytra",
                "city",
                "park",
                "multiplayer",
                "singleplayer",
                "co-op"
            ],
            difficulty: [
                "chill",
                "easy",
                "normal",
                "hard"
            ],
            theme: [
                "medieval",
                "modern",
                "fantasy",
                "sci-fi",
                "realistic",
                "vanilla"
            ],
            length: [
                "short",
                "medium",
                "long"
            ],
        });
    }));
}
export function findMaps(requestQuery, useProjection) {
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
        if (requestQuery.status && (!requestQuery.exclusiveStatus || requestQuery.exclusiveStatus === "false")) {
            console.log(requestQuery.status);
            query.buildQueryWithOperation("status", Number.parseInt(requestQuery.status), "$gte");
        }
        else if (requestQuery.status) {
            query.buildQuery("status", Number.parseInt(requestQuery.status));
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
        else {
            requestQuery.setLimit(20);
        }
        if (query.limit === 0) {
            query.setLimit(20);
        }
        if (requestQuery.page) {
            if (requestQuery.page < 0) {
                requestQuery.page = "0";
            }
            query.setSkip(Number.parseInt(requestQuery.page) * query.limit);
        }
        const projection = {
            title: 1,
            // score: { $meta: "textScore" },
            "files.minecraftVersion": 1,
            shortDescription: 1,
            downloads: 1,
            views: 1,
            rating: 1,
            creators: 1,
            images: 1,
            slug: 1,
            createdDate: 1,
            status: 1
        };
        if (useProjection)
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
export function performSearch(requestQuery) {
    return __awaiter(this, void 0, void 0, function* () {
        let search = new Search();
        switch (requestQuery.sort) {
            case "newest":
                search.sort("createdDate", "desc");
                break;
            case "updated":
                search.sort("updatedDate", "desc");
                break;
            case "title_ascending":
                search.sort("title", "asc");
                break;
            case "title_descending":
                search.sort("title", "desc");
                break;
            case "oldest":
                search.sort("createdDate", "asc");
                break;
            case "highest_rated":
                search.sort("rating", "desc");
                break;
            case "lowest_rated":
                search.sort("rating", "asc");
                break;
            case "creator_ascending":
                search.sort("creators.username", "asc");
                break;
            case "creator_descending":
                search.sort("creators.username", "desc");
                break;
            // case "best_match": 
            // 	sort = {score: {$meta: "textScore"}}
            // 	break;
            default:
                search.sort("createdDate", "desc");
                break;
        }
        if (requestQuery.status && (!requestQuery.exclusiveStatus || requestQuery.exclusiveStatus === "false")) {
            search.filter("status", ">=", Number.parseInt(requestQuery.status));
        }
        else if (requestQuery.status) {
            search.filter("status", "=", Number.parseInt(requestQuery.status));
        }
        else {
            search.filter("status", ">=", 2);
        }
        if (requestQuery.version) {
            requestQuery.version.replace(".0", "");
            search.filter("files.minecraftVersion", "=", requestQuery.version);
        }
        if (requestQuery.search && !(requestQuery.search === "undefined" || requestQuery.search === "null")) {
            search.query(requestQuery.search, false);
        }
        if (requestQuery.limit && requestQuery.page) {
            search.paginate(Number.parseInt(requestQuery.limit), Number.parseInt(requestQuery.page) + 1);
        }
        if (requestQuery.includeTags) {
            let tags = requestQuery.includeTags.split(",");
            for (const tag of tags) {
                search.filter("tags", "=", tag, "AND");
            }
        }
        if (requestQuery.excludeTags) {
            let tags = requestQuery.excludeTags.split(",");
            for (const tag of tags) {
                search.filter("tags", "!=", tag, "AND");
            }
        }
        try {
            let documents = yield search.execute();
            if (!documents) {
                console.error("Meilisearch is probably not initialized.");
                return { totalCount: 0, documents: [] };
            }
            return { totalCount: (search.hitsPerPageS) ? documents.totalHits : documents.estimatedTotalHits, documents: documents.hits.map((doc) => doc) };
        }
        catch (e) {
            sendLog("performSearch", e);
            return { totalCount: 0, documents: [] };
        }
    });
}
