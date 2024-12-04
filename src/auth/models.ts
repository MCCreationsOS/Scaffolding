export interface MicrosoftUser {
    id: string
    email: string,
    sub: string,
    name?: string
    givenname: string
    familyname: string
}

export interface DiscordUser {
    id: string
    email: string
    global_name: string
    avatar: string
    banner?: string
}

export interface GithubUser {
    id: string
    email: string
    login: string
    avatar_url: string
}

export interface GoogleUser {
    id: string
    email: string
    name: string
    picture: string
}