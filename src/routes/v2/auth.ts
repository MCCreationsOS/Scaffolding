import { Static } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";
import { sanitizeUser, signInWithDiscord, signInWithEmail, signInWithGithub, signInWithGoogle, signInWithMicrosoft, signUpWithEmail } from "../../auth/user";
import { FullUser, Providers } from "../../database/models/users";
import { Router } from "../router";
import { User } from "../../schemas/user";
import { GenericResponseType } from "../../schemas/generic";

/**
 * Route arguments for signing a user in
 */
const SignInSchema = Type.Object({
    /**
     * The email of the user
     */
    email: Type.String(),
    /**
     * The password of the user
     */
    password: Type.String(),
    /**
     * The code of the user
     */
    code: Type.String(),
    /**
     * The provider of the user
     */
    provider: Type.Enum(Providers)
})

type SignInBody = Static<typeof SignInSchema>

/**
 * Route arguments for signing up a user
 */
const SignUpSchema = Type.Object({
    /**
     * The username of the user
     */
    username: Type.String(),
    /**
     * The email of the user
     */
    email: Type.String(),
    /**
     * The password of the user
     */
    password: Type.String(),
    /**
     * The code of the user
     */
    code: Type.String(),
    /**
     * The provider of the user
     */
    provider: Type.Enum(Providers)
})

type SignUpBody = Static<typeof SignUpSchema>

/**
 * Route for signing a user in
 */
Router.app.post<{ 
    Body: SignInBody, 
    Reply: GenericResponseType<typeof User> 
}>("/sign_in", async (req, res) => {
    let user: FullUser | null = null

    // Sign in with the provider
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

/**
 * Route for signing up a user
 */
Router.app.post<{ 
    Body: SignUpBody, 
    Reply: GenericResponseType<typeof User> 
}>("/sign_up", async (req, res) => {
    let user: FullUser | null = null

    // Sign up with the provider
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
        return res.code(400).send({error: "Invalid email or username"})
    } else {
        return res.code(200).send(sanitizeUser(user))
    }
})