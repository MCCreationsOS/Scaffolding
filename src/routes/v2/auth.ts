import { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";
import { sanitizeUser, signInWithDiscord, signInWithEmail, signInWithGithub, signInWithGoogle, signInWithMicrosoft, signUpWithEmail } from "../../auth/user";
import { FullUser, Providers } from "../../database/models/users";
import { Router } from "../router";
import { User } from "../../schemas/user";
import { GenericResponseType } from "../../schemas/generic";

const SignInSchema = Type.Object({
    email: Type.String(),
    password: Type.String(),
    code: Type.String(),
    provider: Type.Enum(Providers)
})

type SignInBody = Static<typeof SignInSchema>

const SignUpSchema = Type.Object({
    username: Type.String(),
    email: Type.String(),
    password: Type.String(),
    code: Type.String(),
    provider: Type.Enum(Providers)
})

type SignUpBody = Static<typeof SignUpSchema>

Router.app.post<{ 
    Body: SignInBody, 
    Reply: GenericResponseType<typeof User> 
}>("/sign_in", async (req, res) => {
    let user: FullUser | null = null
    switch (req.body.provider) {
        case Providers.Discord:
            user = await signInWithDiscord(req.body.code)
            break;
        case Providers.Google:
            user = await signInWithGoogle(req.body.code)
            break;
        case Providers.Microsoft:
            user = await signInWithMicrosoft(req.body.code)
            break;
        case Providers.Github:
            user = await signInWithGithub(req.body.code)
            break;
        default:
            user = await signInWithEmail(req.body.email, req.body.password)
            break;
    }
    if(!user) {
        res.code(400).send({error: "Invalid provider"})
    } else {
        res.code(200).send(sanitizeUser(user))
    }
})

Router.app.post<{ 
    Body: SignUpBody, 
    Reply: GenericResponseType<typeof User> 
}>("/sign_up", async (req, res) => {
    let user: FullUser | null = null
    switch (req.body.provider) {
        case Providers.Discord:
            user = await signInWithDiscord(req.body.code)
            break;
        case Providers.Google:
            user = await signInWithGoogle(req.body.code)
            break;
        case Providers.Microsoft:
            user = await signInWithMicrosoft(req.body.code)
            break;
        case Providers.Github:
            user = await signInWithGithub(req.body.code)
            break;
        default:
            user = await signUpWithEmail(req.body.username, req.body.email, req.body.password)
            break;
    }
    if(!user) {
        res.code(400).send({error: "Invalid email or username"})
    } else {
        res.code(200).send(sanitizeUser(user))
    }
})