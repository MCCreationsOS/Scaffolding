import { Database } from "../db/connect.js";
import { app } from "../index.js";

export function initializeCreatorRoutes() {
    app.get('/creator/:uid', async (req, res) => {
        let database = new Database("content", "creators")
        let creator = await database.collection.findOne({uid: req.params.uid})
        res.send(creator);
    })

    app.post('/creator', async (req, res) => {
        let database = new Database("content", "creators")
    
        // database.collection.insertOne()
    })
}