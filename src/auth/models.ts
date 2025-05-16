/**
 * @remarks The user object returned from the Microsoft OAuth API
 */
export interface MicrosoftUser {
    id: string
    email: string,
    sub: string,
    name?: string
    given_name: string
    family_name: string
}

/**
 * @remarks The user object returned from the Discord OAuth API
 */
export interface DiscordUser {
    id: string
    email: string
    global_name: string
    avatar: string
    banner?: string
}

/**
 * @remarks The user object returned from the Github OAuth API
 */
export interface GithubUser {
    id: string
    email: string
    login: string
    avatar_url: string
}

/**
 * @remarks The user object returned from the Google OAuth API
 */
export interface GoogleUser {
    id: string
    email: string
    name: string
    picture: string
}