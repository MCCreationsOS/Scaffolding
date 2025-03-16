import { Router } from "../router";
import { Leaderboard } from "../../schemas/leaderboard";
import { Database } from "../../database";
import { Type, Static, TVoid } from "@sinclair/typebox";
import { AuthorizationHeader } from '../../schemas/auth';
import { ErrorSchema, GenericResponseType } from "../../schemas/generic";
import { ContentType, TContentType } from "../../schemas/creation";
import { processAuthorizationHeader } from "../../auth/user";
import { UserType } from "../../schemas/user";
import { ObjectId } from "mongodb";

Router.app.get<{
    Params: {
        type: string,
        slug: string
    }
}>("/leaderboards/:type/:slug", async (req, res) => {
    let database = new Database<Leaderboard>("content", "leaderboards")
    let leaderboard = await database.findOne({slug: req.params.slug, type: req.params.type})
    return res.send(leaderboard)
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
        leaderboard = {
            _id: new ObjectId(),
            slug: req.params.slug,
            type: req.params.type,
            scores: []
        }
    }

    let user: UserType | undefined = undefined

    try {
        user = await processAuthorizationHeader(req.headers.authorization + "")
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
    return res.status(200).send()
})