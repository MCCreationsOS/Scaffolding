import { Static, Type } from "@sinclair/typebox";
import { ObjectId } from "mongodb";
export const LeaderboardScore = Type.Object({
    username: Type.String(),
    handle: Type.Optional(Type.String()),
    score: Type.Number(),
    date: Type.Number(),
    device: Type.String(),
    location: Type.String(),
    score_type: Type.String()
})

export type LeaderboardScore = Static<typeof LeaderboardScore>

export const Leaderboard = Type.Object({
    _id: Type.Unsafe<ObjectId>(),
    slug: Type.String(),
    type: Type.String(),
    scores: Type.Array(LeaderboardScore)
})

export type Leaderboard = Static<typeof Leaderboard>