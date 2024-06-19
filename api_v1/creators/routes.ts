import { Database } from "../db/connect.js";
import { app } from "../index.js";

export function initializeCreatorRoutes() {
    app.get('/creator/:handle', async (req, res) => {
        let database = new Database("content", "creators")
        let creator = await database.collection.findOne({handle: req.params.handle})
        res.send(creator);
    })

    app.post('/creator', async (req, res) => {
        let database = new Database("content", "creators")
    
        // database.collection.insertOne()
    })
}