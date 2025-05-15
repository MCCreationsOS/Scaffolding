import { Static, TObject } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";
import { createJWT, sanitizeUser, signInWithDiscord, signInWithEmail, signInWithGithub, signInWithGoogle, signInWithMicrosoft, signUpWithEmail } from "../../auth/user";
import { FullUser, Providers } from "../../database/models/users";
import { Router } from "../router";
import { User } from "../../schemas/user";
import { ErrorSchema, GenericResponseType } from "../../schemas/generic";

const SignInSchema = Type.Object({
    email: Type.Optional(Type.String({description: "The email of the user", format: "email"})),
    password: Type.Optional(Type.String({description: "The password of the user"})),
    code: Type.Optional(Type.String({description: "The code of the user (only used for OAuth providers)"})),
    provider: Type.Optional(Type.Number({description: "The provider of the user ", examples: ["[0: discord, 1: google, 2: microsoft, 3: github]"]}))
}, {description: "Information about the user to sign in"})

type SignInBody = Static<typeof SignInSchema>

const SignUpSchema = Type.Object({
    username: Type.Optional(Type.String({description: "The username of the user"})),
    email: Type.Optional(Type.String({description: "The email of the user", format: "email"})),
    password: Type.Optional(Type.String({description: "The password of the user"})),
    code: Type.Optional(Type.String({description: "The code of the user (only used for OAuth providers)"})),
    provider: Type.Optional(Type.Number({description: "The provider of the user", examples: ["[0: discord, 1: google, 2: microsoft, 3: github]"]}))
}, {description: "Information about the user to sign up"})

type SignUpBody = Static<typeof SignUpSchema>

const AuthResponseSchema = Type.Object({
    user: User,
    jwt: Type.String({description: "The JWT for the user"})
}, {description: "The response for signing a user in"})

Router.app.post<{ 
    Body: SignInBody, 
    Reply: GenericResponseType<typeof AuthResponseSchema>
}>("/sign_in", async (req, res) => {
    let result: {user: FullUser, jwt: string} | null = null

    if(!(req.body.email && req.body.password) && !(req.body.provider && req.body.code)) {
        return res.code(400).send({error: "Email and password or provider and code are required"})
    }

    // Sign in with the provider
    switch (req.body.provider) {
        case Providers.Discord:
            result = await signInWithDiscord(req.body.code!)
            break;
        case Providers.Google:
            console.log("Signing in with Google")
            result = await signInWithGoogle(req.body.code!)
            break;
        case Providers.Microsoft:
            result = await signInWithMicrosoft(req.body.code!)
            break;
        case Providers.Github:
            result = await signInWithGithub(req.body.code!)
            break;
        default:
            result = await signInWithEmail(req.body.email!, req.body.password!)
            break;
    }
    if(!result) {
        res.code(400).send({error: "Invalid provider"})
    } else {
        res.code(200).send({user: sanitizeUser(result.user), jwt: result.jwt})
    }
})

Router.app.post<{ 
    Body: SignUpBody, 
    Reply: GenericResponseType<typeof AuthResponseSchema>
}>("/sign_up", async (req, res) => {
    let result: {user: FullUser, jwt: string} | null = null
    let user: FullUser | null = null

    if(!(req.body.email && req.body.password) && !(req.body.provider && req.body.code)) {
        return res.code(400).send({error: "Email and password or provider and code are required"})
    }

    // Sign up with the provider
    switch (req.body.provider) {
        case Providers.Discord:
            result = await signInWithDiscord(req.body.code!)
            break;
        case Providers.Google:
            result = await signInWithGoogle(req.body.code!)
            break;
        case Providers.Microsoft:
            result = await signInWithMicrosoft(req.body.code!)
            break;
        case Providers.Github:
            result = await signInWithGithub(req.body.code!)
            break;
        default:
            user = await signUpWithEmail(req.body.username!, req.body.email!, req.body.password!)
            break;
    }
    if(!result && !user) {
        return res.code(400).send({error: "Invalid email or username"})
    } else {
        if(result) {
            return res.code(200).send({user: sanitizeUser(result.user), jwt: result.jwt})
        } else {
            return res.code(200).send({user: sanitizeUser(user!), jwt: createJWT({_id: user!._id, createdDate: new Date()})})
        }
    }
})