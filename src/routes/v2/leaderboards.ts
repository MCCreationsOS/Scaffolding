import { Router } from "../router";
import { Leaderboard } from "../../schemas/leaderboard";
import { Database } from "../../database";
import { Type, Static, TVoid } from "@sinclair/typebox";
import { AuthorizationHeader } from '../../schemas/auth';
import { GenericResponseType } from "../../schemas/generic";
import { ContentType } from "../../schemas/creation";
import { getUserFromJWT } from "../../auth/user";
import { UserType } from "../../schemas/user";

Router.app.get<{
    Params: {
        type: string,
        slug: string
    }
}>("/leaderboards/:type/:slug", async (req, res) => {
    let database = new Database<Leaderboard>("content", "leaderboards")
    let leaderboard = await database.findOne({slug: req.params.slug, type: req.params.type})
    res.send(leaderboard)
})

const LeaderboardSubmitBody = Type.Object({
    username: Type.String(),
    score: Type.Number(),
    score_type: Type.String()
})

type LeaderboardSubmitBody = Static<typeof LeaderboardSubmitBody>

Router.app.post<{
    Params: {
        type: ContentType,
        slug: string
    },
    Body: LeaderboardSubmitBody,
    Headers: AuthorizationHeader,
    Reply: GenericResponseType<TVoid>
}>("/leaderboards/:type/:slug", async (req, res) => {
    let database = new Database<Leaderboard>("content", "leaderboards")
    let leaderboard = await database.findOne({slug: req.params.slug, type: req.params.type})
    if(!leaderboard) {
        res.status(404).send({error: "Leaderboard not found"})
        return
    }

    let user: UserType | undefined = undefined

    try {
        user = await getUserFromJWT(req.headers.authorization + "")
    } catch(err) {

    }
    
    let score = {
        username: req.body.username,
        handle: user?.handle,
        score: req.body.score,
        date: Date.now(),
        device: req.headers['user-agent']?.includes("Macintosh") ? "Mac" : "Windows",
        location: req.headers['cf-ipcountry'] + "",
        score_type: req.body.score_type
    }

    await database.updateOne({slug: req.params.slug, type: req.params.type}, {$push: {scores: score}})
    res.status(200).send()
})