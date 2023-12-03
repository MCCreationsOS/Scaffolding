import { app } from "../index.js";
import { Database } from "../db/connect.js";
import { rateContent } from "./rate.js";

export function initializeCommunityRoutes() {
    app.post('/rate', async (req, res) => {
        let rating = await rateContent(Number.parseFloat(req.body.rating), req.body.map)
        res.send({rating: rating})
    })

    app.post('/maps/rate', async (req, res) => {
        let rating = await rateContent(Number.parseFloat(req.body.rating), req.body.map)
        res.send({message: "This route is out of date, please use /rate.", rating: rating})
    })
    
    app.post('/maps/comment/:slug', async (req, res) => {
        let database = new Database();
    
        database.collection.updateOne({slug: req.params.slug}, {$push: {comments: {username: req.body.username, comment: req.body.comment, date: Date.now(), likes: 0, comments: {}}}})
        res.sendStatus(200)
    })
}