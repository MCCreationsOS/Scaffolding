import { ObjectId } from "mongodb";
import { Database } from "../database";
import { FullUser, Providers } from "../database/models/users";
import { UserType, UserTypes } from "../schemas/user";
import bcrypt from "bcrypt";
import jwt from 'jsonwebtoken'
import { DiscordUser, GithubUser, GoogleUser, MicrosoftUser } from "./models";
import { env } from "../env";
const saltRounds = 10;
export let JWTKey = env.JWTKey

/**
 * Finds a user by their provider id and provider
 * @param id The id of the user
 * @param provider The provider of the user
 * @returns The user if found, null otherwise
 */
async function findExistingUser(id: string, provider: Providers): Promise<FullUser | null> {
    const database = new Database<FullUser>("creators")
    let user = await database.findOne({ "providers.id": id, "providers.provider": provider})
    if(user && user.providers && user.providers.length > 0) {
        let foundProvider = false;
        user.providers?.forEach(p => {
            if(p.provider === provider && p.id === id) foundProvider = true
        })
        if(foundProvider) return user
    }
    return null
}

/**
 * Compares a password to a hash
 * @param password The password to compare
 * @param hash The hash to compare to
 * @returns Whether the password matches the hash
 */
export function bcryptCompare(password: string, hash: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        bcrypt.compare(password, hash, (err, same) => {
            resolve(same)
        })
    })
}

/**
 * Hashes a password
 * @param password The password to hash
 * @returns The hashed password
 */
export function bcryptHash(password: string): Promise<string> {
    return new Promise((resolve, reject) => {
        bcrypt.hash(password, saltRounds, (err, hash) => {
            resolve(hash)
        })
    })
}

export function createJWT(data: any, expiresIn: string = "30d") {
    return jwt.sign(data, JWTKey, { expiresIn: expiresIn })
}

export async function signInWithEmail(email: string, password: string): Promise<FullUser | null> {
    const database = new Database<FullUser>("creators")
    let user = await database.findOne({email: email})
    if(!user) return null
    if(!user.password) return null

    return new Promise((resolve, reject) => {
        bcrypt.compare(password, user.password!, (err, same) => {
            if(same) resolve(user)
            else reject(null)
        })
    })
}

export async function signUpWithEmail(username: string, email: string, password: string): Promise<FullUser | null> {
    const database = new Database<FullUser>("creators")
    let user = await database.findOne({email: email})
    if(user) return null

    let hashedPassword = await bcrypt.hash(password, saltRounds)
    let handle = username.toLowerCase().replace(" ", "-")

    user = await database.findOne({handle: handle})
    if(user) handle = handle + Math.floor(Math.random() * 10000)

    let newUser: FullUser = {
        _id: new ObjectId(),
        username: username,
        email: email,
        password: hashedPassword,
        handle: handle,
        type: UserTypes.Account,
        providers: [],
        iconURL: "https://next.mccreations.net/mcc_no_scaffold.png"
    }

    await database.insertOne(newUser)
    return newUser
}

/**
 * Signs in with discord
 * @param code The oauth code (not access token) from discord
 * @returns The user if found, null otherwise
 */
export async function signInWithDiscord(code: string): Promise<FullUser> {
    let access_token = await getDiscordAccessToken(code)
    let discordUser = await getDiscordUser(access_token)
    let existingUser = await findExistingUser(discordUser.id, Providers.Discord)

    if(existingUser) return existingUser
    else return createUserFromProviderData(discordUser.email, discordUser.global_name, Providers.Discord, access_token, "", discordUser.id, discordUser.avatar, discordUser.banner)
}

/**
 * Gets the access token from discord
 * @param code The oauth code from discord
 * @returns The access token
 */
export async function getDiscordAccessToken(code: string): Promise<string> {
    let res = await fetch('https://discord.com/api/oauth2/token', {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            'client_id': env.DISCORD_CLIENT_ID + "",
            'client_secret': env.DISCORD_SECRET + "",
            code,
            'grant_type': 'authorization_code',
            'redirect_uri': 'https://mccreations.net/auth/oauth_handler?provider=discord',
            'scope': 'identify+email'
        }).toString(),
        method: 'POST'
    })
    let data = await res.json();
    let access_token = data.access_token;

    return access_token
}

/**
 * Gets the user from discord
 * @param access_token The access token from discord
 * @returns The user
 */
export async function getDiscordUser(access_token: string): Promise<DiscordUser> {
    let res = await fetch('https://discord.com/api/users/@me', {
        headers: {
            authorization: `Bearer ${access_token}`
        }
    })
    let discordUser = await res.json();
    return discordUser
}

/**
 * Signs in with github
 * @param code The oauth code (not access token) from github
 * @returns The user if found, null otherwise
 */
export async function signInWithGithub(code: string): Promise<FullUser> {
    let access_token = await getGithubAccessToken(code)
    let githubUser = await getGithubUser(access_token)
    let existingUser = await findExistingUser(githubUser.id, Providers.Github)

    if(existingUser) return existingUser
    else return createUserFromProviderData(githubUser.email, githubUser.login, Providers.Github, access_token, "", githubUser.id, githubUser.avatar_url)
}

/**
 * Gets the access token from github
 * @param code The oauth code from github
 * @returns The access token
 */
export async function getGithubAccessToken(code: string): Promise<string> {
    let githubParams = new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID + "",
        client_secret: env.GITHUB_SECRET + "",
        code: code,
        scope: "user:email,read:user"
    })
    let res = await fetch(`https://github.com/login/oauth/access_token?${githubParams.toString()}`, {
        headers: {
            'Accept': 'application/json'
        },
        method: 'POST'
    })
    let data = await res.json();
    return data.access_token
}

/**
 * Gets the user from github
 * @param access_token The access token from github
 * @returns The user
 */
export async function getGithubUser(access_token: string): Promise<GithubUser> {
    let res = await fetch('https://api.github.com/user', {
        headers: {
            authorization: `Bearer ${access_token}`
        }
    })
    let githubUser = await res.json();
    return githubUser
}

/**
 * Signs in with google
 * @param access_token The access token from google
 * @returns The user if found, null otherwise
 */
export async function signInWithGoogle(access_token: string): Promise<FullUser> {
    let googleUser = await getGoogleUser(access_token)
    let existingUser = await findExistingUser(googleUser.id, Providers.Google)

    if(existingUser) return existingUser
    else return createUserFromProviderData(googleUser.email, googleUser.name, Providers.Google, access_token, "", googleUser.id, googleUser.picture)
}

/**
 * Gets the user from google
 * @param access_token The access token from google
 * @returns The user
 */
export async function getGoogleUser(access_token: string): Promise<GoogleUser> {
    let res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: {
            authorization: "Bearer " + access_token
        }
    })
    let data = await res.json();
    return data
}

/**
 * Signs in with microsoft
 * @param code The oauth code (not access token) from microsoft
 * @returns The user if found, null otherwise
 */
export async function signInWithMicrosoft(code: string): Promise<FullUser> {
    let access_token = await getMicrosoftAccessToken(code)
    let microsoftUser = await getMicrosoftUser(access_token)
    let existingUser = await findExistingUser(microsoftUser.id, Providers.Microsoft)

    if(existingUser) return existingUser
    else return createUserFromProviderData(microsoftUser.email, microsoftUser.name ?? microsoftUser.givenname + microsoftUser.familyname, Providers.Microsoft, access_token, "", microsoftUser.id, "")
}

/**
 * Gets the access token from microsoft
 * @param code The oauth code from microsoft
 * @returns The access token
 */
export async function getMicrosoftAccessToken(code: string): Promise<string> {
    let res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            'client_id': env.MICROSOFT_CLIENT_ID + "",
            'client_secret': env.MICROSOFT_SECRET + "",
            'code': code,
            'grant_type': 'authorization_code',
            'redirect_uri': 'https://mccreations.net/auth/oauth_handler',
            'scope': 'openid email profile'
        }).toString(),
        method: 'POST'
    })
    let data = await res.json();
    let access_token = data.access_token;

    return access_token
}

/**
 * Gets the user from microsoft
 * @param access_token The access token from microsoft
 * @returns The user
 */
export async function getMicrosoftUser(access_token: string): Promise<MicrosoftUser> {
    let res = await fetch('https://graph.microsoft.com/oidc/userinfo', {
        headers: {
            authorization: `Bearer ${access_token}`
        }
    })
    let microsoftUser = await res.json();
    return microsoftUser
}

/**
 * Creates a user JSON object from provider data. Does not save to database.
 * @param email The email of the user
 * @param username The username of the user
 * @param provider The provider of the user
 * @param token The token of the user
 * @param refreshToken The refresh token of the user
 * @param id The id of the user
 * @param iconURL The icon URL of the user
 * @param bannerURL The banner URL of the user
 * @returns The user that was created
 */
async function createUserFromProviderData(email: string, username: string, provider: Providers, token: string, refreshToken: string, id: string, iconURL: string, bannerURL?: string): Promise<FullUser> {
    const database = new Database<FullUser>("creators")

    let user: FullUser = {
        _id: new ObjectId(),
        username: username + "",
        email: email,
        type: UserTypes.Account,
        iconURL: iconURL,
        bannerURL: bannerURL,
        providers: [
            {
                provider: provider,
                token: token,
                refreshToken: refreshToken,
                id: id
            }
        ]
    }
    let userWithHandle = await database.findOne({handle: user.username})
    if(userWithHandle) {
        user.handle = username.toLowerCase().replace(" ", "-") + Math.floor(Math.random() * 10000)
    }
    else {
        user.handle = username.toLowerCase().replace(" ", "-");
    }

    return user

}

/**
 * Gets a user from a JWT
 * @param jwtString The JWT
 * @returns The user if found, null otherwise
 */
export async function getUserFromJWT(jwtString: string) {
    try {
        let token = jwt.verify(jwtString, JWTKey) as any
        if(token && token._id) {
            let _id = new ObjectId(token._id)
            let database = new Database<FullUser>("creators")
            let user = await database.findOne({_id: _id})
            if(user && ((user.last_important_update && token.createdDate && user.last_important_update < token.createdDate) || !user.last_important_update)) {
                return sanitizeUser(user)
            } else {
                throw new Error("Session expired, please sign in and try again")
            }
        } else {
            throw new Error("Session expired, please sign in and try again")
        }
    } catch(err) {
        throw new Error("Session expired, please sign in and try again")
    }
}

/**
 * Gets an unsanitized user from a JWT. Use this with **extreme caution**.
 * @param jwtString The JWT
 * @returns The user if found, null otherwise
 */
export async function _dangerouslyGetUnsanitizedUserFromJWT(jwtString: string) {
    try {
        let token = jwt.verify(jwtString, JWTKey) as any
        if(token && token._id) {
            let _id = new ObjectId(token._id)
            let database = new Database<FullUser>("creators")
            return await database.findOne({_id: _id})
        } else {
            throw new Error("Session expired, please sign in and try again")
        }
    } catch(err) {
        throw new Error("Session expired, please sign in and try again")
    }
}

/**
 * Gets the id from a JWT
 * @param jwtString The JWT
 * @returns The id if found, null otherwise
 */
export function getIdFromJWT(jwtString: string) {
    try {
        let token = jwt.verify(jwtString, JWTKey) as any
        if(token && token._id) {
            return new ObjectId(token._id)
        }
    } catch(e) {
        throw new Error("Session expired, please sign in and try again")
    }
}

/**
 * Checks if an object is a user
 * @param object The object to check
 * @returns Whether the object is a user
 */
function instanceOfUser(object: any) {
    return 'username' in object
}

/**
 * Refreshes the JWT hash
 */
export async function refreshJWTHash() {
    JWTKey = (await crypto.getRandomValues(new Uint8Array(256))).join("")
}

/**
 * Sanitizes a user, removing sensitive information that should never be sent to the client
 * @param user The user to sanitize
 * @returns The sanitized user
 */
export function sanitizeUser(user: FullUser): UserType {
    return {
        ...{...user, password: undefined, providers: undefined, last_important_update: undefined},
    }
}