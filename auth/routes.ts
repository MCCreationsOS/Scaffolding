import { app } from "../index.js";
import bcrypt from "bcrypt";
import { User } from "./types.js";
import { Database } from "../db/connect.js";
const saltRounds = 10;

export function initializeAuthRoutes() {
    app.get('/auth/user/:email', (req, res) => {

    })

    app.post('/auth/signUpWithEmail', (req, res) => {
        let user = req.body.user as User
        let database = new Database("content", "creators")

        if(!user.password) {
            res.send({message: "No password provided"}); 
            res.sendStatus(403); 
            return;
        }

        bcrypt.hash(user.password, saltRounds, (err, hash) => {
            if(err) {
                res.send({message: "Hashing Error!"})
                res.sendStatus(500)
                return;
            }

            user.password = undefined;
            user.password = hash;

            database.collection.insertOne(user)
        })
    })

    app.get('/auth/signUpWithProvider', (req, res) => {
        let user: User;

        console.log(req)
    })
}