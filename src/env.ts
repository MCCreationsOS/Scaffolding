import dotenv from 'dotenv';
dotenv.config();

export const env = {
    MONGODB_URI: process.env.MONGODB_URI || "",
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || "",
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || "",
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || "",
    MEILISEARCH_KEY: process.env.MEILISEARCH_KEY || "",
    DISCORD_UPDATE_WEBHOOK_URL: process.env.DISCORD_UPDATE_WEBHOOK_URL || "",
    DISCORD_ADMIN_WEBHOOK_URL: process.env.DISCORD_ADMIN_WEBHOOK_URL || "",
    DISCORD_FORUM_WEBHOOK_URL: process.env.DISCORD_FORUM_WEBHOOK_URL || "",
    JWTKey: process.env.JWTKey || "",
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "",

    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || "",
    DISCORD_SECRET: process.env.DISCORD_SECRET || "",
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN || "",

    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || "",
    GITHUB_SECRET: process.env.GITHUB_SECRET || "",

    MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID || "",
    MICROSOFT_SECRET: process.env.MICROSOFT_SECRET || "",

    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || "",
}