import { Client, GatewayIntentBits, REST, Routes } from "discord.js"
import { performSearch } from "../api_v1/content/searching"

const commands = [
    {
        name: "search",
        description: "Search for content on MCCreations",
        type: 1,
        options: [
            {
                type: 3,
                name: "search",
                description: "The search query",
                required: true
            }
        ]
    },
    {
        "name": "subscribe",
        "description": "Subscribe this channel to various updates",
        "type": 1
    }
]


export async function initializeDiscordBot() {
    const rest = new REST({version: "10"}).setToken(process.env.DISCORD_SECRET + "")
    
    try {
        await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID + ""), {body: commands})
    } catch(e) {
        console.log(e)
    }

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds
        ]
    })
    
    client.on("interactionCreate", async (interaction) => {
        if(!interaction.isChatInputCommand()) return;
    
        if(interaction.commandName === "search") {
            let query = interaction.options.getString("search")
            let results = await performSearch({search: query})
            interaction.reply(results.documents.map(doc => doc.title + " by " + doc.creators.map(creator => creator.username).join(", ")).join("\n"))
        }
    })
    
    client.login(process.env.DISCORD_SECRET + "")
}
