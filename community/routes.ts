import { app } from "../index.js";
import { Database } from "../db/connect.js";

export function initializeCommunityRoutes() {
    app.post('/maps/rate/:slug', async (req, res, next) => {
        let database = new Database();
        let map = req.body.map
        
        // Calculate new rating
        let rating = 0;
        let ratings = map.ratings;
        let rates = 1;
        if(ratings) {
            rates = map.ratings.length + 1;
            ratings.push(Number.parseFloat(req.body.rating))
        } else {
            ratings = [Number.parseFloat(req.body.rating)]
        }
    
        for(let i = 0; i < rates; i++) {
            rating += ratings[i];
        }
        rating = rating/(rates + 0.0);
    
        database.collection.updateOne({slug: map.slug}, {$push: {ratings: Number.parseFloat(req.body.rating)}, $set : {rating: rating}}).then(() => {
            res.send({rating: rating})
        }).catch((error: any) => {
            console.error(error)
            res.sendStatus(500);
        })
    })
    
    app.post('/maps/comment/:slug', async (req, res) => {
        let database = new Database();
    
        database.collection.updateOne({slug: req.params.slug}, {$push: {comments: {username: req.body.username, comment: req.body.comment, date: Date.now(), likes: 0, comments: {}}}})
        res.sendStatus(200)
    })
}