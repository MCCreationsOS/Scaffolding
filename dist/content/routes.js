var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import axios from "axios";
import { Database } from "../db/connect.js";
import { app } from "../index.js";
import { JSDOM } from 'jsdom';
import jwt from 'jsonwebtoken';
import { JWTKey, getUserFromJWT } from "../auth/routes.js";
import s3 from "aws-sdk";
import { ObjectId } from "mongodb";
import { approvedEmail, requestApprovalEmail } from "../email/email.js";
import puppeteer from "puppeteer";
const { S3 } = s3;
export function initializeContentRoutes() {
    app.post('/content', (req, res) => __awaiter(this, void 0, void 0, function* () {
        if (!req.body.content) {
            res.send({ error: "Content not included in request body" });
            return;
        }
        if (!req.body.content.title) {
            res.send({ error: "Content does not appear to be formatted correctly, title is missing" });
            return;
        }
        if (!req.body.content.type) {
            res.send({ error: "Content does not appear to be formatted correctly, type is missing" });
            return;
        }
        let uploader;
        if (req.headers.authorization) {
            uploader = yield getUserFromJWT(req.headers.authorization);
        }
        let slug = req.body.content.title.toLowerCase().replace(/\s/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
        let i = 1;
        while (yield checkIfSlugUnique(slug + i)) {
            i++;
        }
        slug = slug + i;
        let database = new Database();
        if (req.body.content.type === "Map") {
            let map = {
                title: req.body.content.title,
                shortDescription: req.body.content.summary,
                description: "",
                images: [],
                status: 0,
                downloads: 0,
                views: 0,
                slug: slug,
                rating: 0,
                createdDate: new Date(Date.now())
            };
            let result = yield database.collection.insertOne(map);
            if (uploader && uploader.user) {
                database.collection.updateOne({ _id: result.insertedId }, { $push: { creators: { username: uploader.user.username, handle: uploader.user.handle } } });
                res.send({ slug: map.slug });
                return;
            }
            else {
                let key = jwt.sign({ _id: result.insertedId.toJSON() }, JWTKey, { expiresIn: "24h" });
                res.send({ key: key, slug: map.slug });
                return;
            }
        }
        res.sendStatus(200);
    }));
    app.post("/content/import", (req, res) => __awaiter(this, void 0, void 0, function* () {
        let url = req.body.url;
        let token = req.body.token;
        if (!url) {
            res.send({ error: "URL to import is missing" });
            return;
        }
        let map;
        if (url.startsWith('https://www.planetminecraft.com')) {
            map = yield fetchFromPMC(url);
        }
        else if (url.startsWith('https://www.minecraftmaps.com')) {
            map = yield fetchFromMCMaps(url);
        }
        else {
            res.send({ error: "URL is not supported for importing" });
            return;
        }
        if (map) {
            if (token) {
                let user = yield getUserFromJWT(token);
                if (user.user) {
                    map.creators = [{ username: user.user.username, handle: user.user.handle }];
                }
            }
            let i = 1;
            while (yield checkIfSlugUnique(map.slug + i)) {
                i++;
            }
            map.slug = map.slug + i;
            let database = new Database();
            let result = yield database.collection.insertOne(map);
            let key;
            if (!token) {
                key = jwt.sign({ _id: result.insertedId }, JWTKey, { expiresIn: "24h" });
            }
            res.send({ content: map.slug, key: key });
        }
        else {
            res.send({ error: "Map was not successfully imported" });
        }
    }));
    app.post('/content/update', (req, res) => __awaiter(this, void 0, void 0, function* () {
        var _a;
        let map = req.body.content;
        let database = new Database();
        let user = yield getUserFromJWT(req.headers.authorization + "");
        let currentMap = yield database.collection.findOne({ _id: new ObjectId(map._id) });
        if (!user.user || !currentMap || ((_a = currentMap.creators) === null || _a === void 0 ? void 0 : _a.filter(creator => { var _a; return creator.handle === ((_a = user.user) === null || _a === void 0 ? void 0 : _a.handle); }).length) === 0) {
            console.log("User not found or not creator");
            return res.sendStatus(401);
        }
        if (!map) {
            res.send({ error: "Map not sent in request" });
            return;
        }
        let i = 1;
        while (yield checkIfSlugUnique(map.slug + i)) {
            i++;
        }
        map.slug = map.slug + i;
        let result = yield database.collection.updateOne({ _id: new ObjectId(map._id) }, {
            "$set": {
                title: map.title,
                shortDescription: map.shortDescription,
                description: map.description,
                images: map.images,
                status: map.status,
                downloads: map.downloads,
                slug: map.slug,
                createdDate: new Date(map.createdDate),
                updatedDate: new Date(),
                creators: map.creators,
                files: map.files
            }
        });
        res.send({ result: result });
    }));
    app.post('/content/request_approval', (req, res) => __awaiter(this, void 0, void 0, function* () {
        var _b;
        let link = "https://next.mccreations.net/maps/" + req.body.slug;
        let database = new Database();
        let user = yield getUserFromJWT(req.headers.authorization + "");
        let map = yield database.collection.findOne({ slug: req.body.slug });
        if (!user.user || !map || ((_b = map.creators) === null || _b === void 0 ? void 0 : _b.filter(creator => { var _a; return creator.handle === ((_a = user.user) === null || _a === void 0 ? void 0 : _a.handle); }).length) === 0) {
            return res.sendStatus(401);
        }
        requestApprovalEmail(link);
        //https://discord.com/api/webhooks/1219390163105484860/pFfUP8gY7xP3OCkQpDSbcyPhZ5GbG485xl0Y3XrxRqpylSTiZ6S1PWVvXqjYEvzs3cFE
        yield database.collection.updateOne({ slug: req.body.slug }, { $set: { status: 1 } });
        res.sendStatus(200);
        fetch('https://discord.com/api/webhooks/1219390163105484860/pFfUP8gY7xP3OCkQpDSbcyPhZ5GbG485xl0Y3XrxRqpylSTiZ6S1PWVvXqjYEvzs3cFE', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: "New Map Requesting Approval: " + link
            })
        }).then(response => {
            console.log(response);
        });
    }));
    app.get('/content/:slug/approve', (req, res) => __awaiter(this, void 0, void 0, function* () {
        var _c;
        let database = new Database();
        let user = yield getUserFromJWT(req.headers.authorization + "");
        if (!user.user || user.user.handle !== "crazycowmm") {
            return res.sendStatus(401);
        }
        yield database.collection.updateOne({ slug: req.params.slug }, { $set: { status: 2 } });
        res.sendStatus(200);
        let map = yield database.collection.findOne({ slug: req.params.slug });
        if (map) {
            let creators = map.creators;
            creators === null || creators === void 0 ? void 0 : creators.forEach((creator) => __awaiter(this, void 0, void 0, function* () {
                let user = yield database.collection.findOne({ handle: creator.handle });
                if (user && user.email) {
                    approvedEmail(user.email, "https://next.mccreations.net/maps/" + req.params.slug, (map === null || map === void 0 ? void 0 : map.title) + "");
                }
            }));
            let discordMessage = {
                content: "<@&883788946327347210>",
                allowed_mentions: {
                    roles: [
                        "883788946327347210"
                    ]
                },
                embeds: [
                    {
                        title: map.title,
                        //   type: "rich",
                        description: map.shortDescription + " https://next.mccreations.net/maps/" + map.slug,
                        url: "https://next.mccreations.net/maps/" + map.slug,
                        //   timestamp: Date.now(),
                        //   color: 1,
                        image: {
                            url: map.images[0]
                        },
                        author: {
                            name: (_c = map.creators) === null || _c === void 0 ? void 0 : _c.map(creator => creator.username).join(", ")
                        }
                    }
                ]
            };
            fetch("https://discord.com/api/webhooks/1020486876391559238/_efhzBaZTdt5IAHt3_YzBy2oOT5AYvoxg2Nr0lxMFaM3c6i8PYiuGXoOt_KZLHryZvLs", {
                method: 'post',
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(discordMessage)
            });
        }
    }));
    app.post('/content/rate/:slug', (req, res) => __awaiter(this, void 0, void 0, function* () {
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
        database.collection.updateOne({ slug: req.params.slug }, { $set: { ratings: ratings, rating: rating } }).then(() => {
            res.send({ rating: rating });
        });
    }));
}
const bucket = new S3({
    region: 'us-west-1',
    accessKeyId: "***REMOVED***",
    secretAccessKey: "***REMOVED***"
});
function upload(file, name) {
    return __awaiter(this, void 0, void 0, function* () {
        const params = {
            Bucket: 'mccreations',
            Key: name,
            Body: file
        };
        try {
            const u = bucket.upload(params);
            let data = yield u.promise();
            console.log("Uploaded " + name);
            return data.Location;
        }
        catch (error) {
            return error;
        }
    });
}
function fetchFromPMC(url) {
    var _a, _b, _c, _d;
    return __awaiter(this, void 0, void 0, function* () {
        let res = yield axios.get(url);
        let html = new JSDOM(res.data).window.document;
        let title = (_b = (_a = html.querySelector('div#resource-title-text h1')) === null || _a === void 0 ? void 0 : _a.textContent) === null || _b === void 0 ? void 0 : _b.trim();
        if (!title)
            return;
        let slug = title.toLowerCase().replace(/\s/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
        let description = (_c = html.querySelector('#r-text-block')) === null || _c === void 0 ? void 0 : _c.innerHTML;
        if (!description)
            return;
        let shortDescription = '';
        let status = 0;
        let downloads = 0;
        let views = 0;
        let rating = 0;
        let createdDate = new Date();
        let users = html.querySelectorAll('.pusername');
        let username = "";
        if (users.length === 1) {
            username = html.querySelectorAll('.pusername')[0].textContent + "";
        }
        else {
            username = html.querySelectorAll('.pusername')[1].textContent + "";
        }
        let map = {
            title: title,
            slug: slug,
            description: description,
            shortDescription: shortDescription,
            status: status,
            downloads: downloads,
            views: views,
            rating: rating,
            createdDate: createdDate,
            images: [],
            creators: [{ username: username }],
            importedUrl: url
        };
        map.files = [{ type: 'world', worldUrl: "https://www.planetminecraft.com" + ((_d = html.querySelector('.branded-download')) === null || _d === void 0 ? void 0 : _d.getAttribute('href')), minecraftVersion: '' }];
        let images = html.querySelectorAll('.rsImg');
        images.forEach((image, idx) => __awaiter(this, void 0, void 0, function* () {
            let url = image.getAttribute('href');
            try {
                let response = yield axios.get(url);
                let buffer = yield response.data;
                upload(new Uint8Array(buffer), `${map.slug}_image_${idx}${url.substring(url.lastIndexOf('.'))}`);
                map.images.push(`https://mccreations.s3.us-west-1.amazonaws.com/${map.slug}_image_${idx}${url.substring(url.lastIndexOf('.'))}`);
            }
            catch (e) {
                map.images.push(url);
            }
        }));
        yield loadAndTransferImages(map);
        return map;
    });
}
function fetchFromMCMaps(url) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    return __awaiter(this, void 0, void 0, function* () {
        const mapInfoLocator = 'Map Info</h2>\n</center></td>\n</tr>\n</tbody>\n</table>';
        const pictureLocator = '<table style="width: 100%;" border="0" cellspacing="0" cellpadding="0">\n<tbody>\n<tr>\n<td class="info_title"><center>\n<h2>Pictures</h2>\n</center></td>\n</tr>\n</tbody>\n</table>';
        const changelogLocator = '<table border="0" width="98%" cellspacing="0" cellpadding="0">\n<tbody>\n<tr>\n<td class="info_title">\n<h2><center>Changelog</center></h2>\n</td>\n</tr>\n</tbody>\n</table>';
        let res = yield axios.get(url);
        let html = new JSDOM(res.data).window.document;
        let descTable = (_c = (_b = (_a = html.querySelector('table')) === null || _a === void 0 ? void 0 : _a.querySelector('table')) === null || _b === void 0 ? void 0 : _b.querySelector('td')) === null || _c === void 0 ? void 0 : _c.innerHTML;
        let statsPanel = (_d = html.querySelector('div.stats_data')) === null || _d === void 0 ? void 0 : _d.querySelectorAll('table')[1];
        if (!descTable)
            return;
        let mapInfoStart = descTable.indexOf(mapInfoLocator);
        let pictureStart = descTable.indexOf(pictureLocator);
        let changelogStart = descTable.indexOf(changelogLocator);
        let title = (_f = (_e = html.querySelector('h1')) === null || _e === void 0 ? void 0 : _e.textContent) === null || _f === void 0 ? void 0 : _f.trim();
        if (!title)
            return;
        let slug = title.toLowerCase().replace(/\s/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
        let description = "";
        if (descTable.includes(pictureLocator)) {
            description = descTable.substring(mapInfoStart + mapInfoLocator.length, pictureStart);
        }
        else {
            description = descTable.substring(mapInfoStart + mapInfoLocator.length, changelogStart);
        }
        description.replace(/\<table style="width: 98%;" border="0" cellspacing="0" cellpadding="0"\>\n\<tbody\>\n\<tr>\n\<td class="info_title"><center>/g, "");
        description.replace(/\<\/center\>\<\/td\>\n\<\/tr\>\n\<\/tbody\>\n\<\/table>/g, "");
        let shortDescription = '';
        let status = 0;
        let downloads = 0;
        let views = 0;
        let rating = 0;
        let createdDate = new Date();
        let username = (statsPanel === null || statsPanel === void 0 ? void 0 : statsPanel.querySelectorAll('tr')[0].querySelectorAll('span')[1].textContent) + "";
        let map = {
            title: title,
            slug: slug,
            description: description,
            shortDescription: shortDescription,
            status: status,
            downloads: downloads,
            views: views,
            rating: rating,
            createdDate: createdDate,
            images: [],
            creators: [{ username: username }],
            importedUrl: url
        };
        map.files = [{
                type: 'world',
                worldUrl: "https://minecraftmaps.com" + ((_g = html.querySelector('.jdbutton')) === null || _g === void 0 ? void 0 : _g.getAttribute('href')),
                minecraftVersion: (statsPanel === null || statsPanel === void 0 ? void 0 : statsPanel.querySelectorAll('tr')[3].querySelectorAll('span')[1].textContent) + "",
                contentVersion: (statsPanel === null || statsPanel === void 0 ? void 0 : statsPanel.querySelectorAll('tr')[2].querySelectorAll('span')[1].textContent) + ""
            }];
        let images = (_k = (_j = (_h = html.querySelector('table')) === null || _h === void 0 ? void 0 : _h.querySelector('table')) === null || _j === void 0 ? void 0 : _j.querySelector('td')) === null || _k === void 0 ? void 0 : _k.querySelectorAll('img');
        if (images) {
            images.forEach((image, idx) => __awaiter(this, void 0, void 0, function* () {
                let url = image.getAttribute('data-src');
                // try {
                //     let response = await axios.get(url);
                //     let buffer = await response.data;
                //     upload(new Uint8Array(buffer), `${map.slug}_image_${idx}${url.substring(url.lastIndexOf('.'))}`);
                //     map.images.push(`https://mccreations.s3.us-west-1.amazonaws.com/${map.slug}_image_${idx}${url.substring(url.lastIndexOf('.'))}`)
                // } catch(e) {
                map.images.push(url);
                // }
            }));
        }
        yield loadAndTransferImages(map);
        return map;
    });
}
function loadAndTransferImages(map) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            puppeteer.launch().then((browser) => __awaiter(this, void 0, void 0, function* () {
                try {
                    let idx = 0;
                    let fileCounter = 0;
                    let uploaded_images = [];
                    let timeoutSeconds = 30;
                    const page = yield browser.newPage();
                    page.on('response', (response) => __awaiter(this, void 0, void 0, function* () {
                        try {
                            const matches = /.*\.(jpg|png|svg|gif|webp)$/.exec(response.url());
                            if (matches && (matches.length === 2) && (response.url().startsWith('https://www.minecraftmaps.com/images/jdownloads/screenshots/') || response.url().startsWith("https://static.planetminecraft.com/files/image/minecraft/"))) {
                                console.log(matches);
                                const extension = matches[1];
                                const buffer = yield response.buffer();
                                fileCounter += 1;
                                let url = yield upload(buffer, `${map.slug}_image_${fileCounter}.${extension}`);
                                uploaded_images.push({ transferredUrl: url, originalUrl: response.url() });
                            }
                        }
                        catch (e) {
                            console.log("Error uploading image: " + e);
                        }
                    }));
                    yield page.goto(map.importedUrl);
                    try {
                        // page.mouse.wheel({deltaY: 2000})
                        while (uploaded_images.length < map.images.length && timeoutSeconds > 0) {
                            yield new Promise(resolve => setTimeout(resolve, 1000));
                            timeoutSeconds--;
                        }
                        yield browser.close();
                        if (timeoutSeconds <= 0) {
                            return;
                        }
                        let database = new Database();
                        for (let i = 0; i < map.images.length; i++) {
                            let image = uploaded_images.find(img => img.originalUrl === map.images[i]);
                            if (image) {
                                map.images[i] = image.transferredUrl;
                            }
                        }
                        yield database.collection.updateOne({ slug: map.slug }, { $set: { images: map.images } });
                    }
                    catch (e) {
                        console.log("Error loading page: " + e);
                    }
                }
                catch (e) {
                    console.log("Error fetching images using puppeteer: " + e);
                }
            }));
        }
        catch (e) {
            console.log("Error launching puppeteer: " + e);
        }
    });
}
export function checkIfSlugUnique(slug) {
    return __awaiter(this, void 0, void 0, function* () {
        let database = new Database();
        return (yield database.collection.findOne({ slug: slug })) !== null;
    });
}
