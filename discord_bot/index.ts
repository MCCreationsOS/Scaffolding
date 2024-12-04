import { ChannelType, Client, GatewayIntentBits, Interaction, REST, Routes } from "discord.js"
import { performSearch } from "../api_v1/content/searching"
import { ContentDocument } from "../api_v1/db/types"
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
})

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
        name: "create",
        description: "Create a new content on MCCreations",
        type: 1,
        options: [
            {
                type: 3,
                name: "type",
                description: "The type of content to create",
                required: true,
                choices: [
                    {
                        name: "Map",
                        value: "map"
                    },
                    {
                        name: "Datapack",
                        value: "datapack"
                    },
                    {
                        name: "Resourcepack",
                        value: "resourcepack"
                    }
                ]
            },
            {
                type: 3,
                name: "title",
                description: "The title of the content",
                required: true
            },
            {
                type: 3,
                name: "summary",
                description: "The summary of the content",
                required: true
            }
        ]
    }
]


export async function initializeDiscordBot() {
    try {
        const rest = new REST({version: "10"}).setToken(process.env.DISCORD_BOT_TOKEN + "")
        
        try {
            await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID + ""), {body: commands})
        } catch(e) {
            console.log(e)
        }
    
        
        client.on("interactionCreate", async (interaction) => {
            handleInteraction(interaction)
        })
        
        client.login(process.env.DISCORD_BOT_TOKEN + "")
    } catch(e) {
        console.log(e)
    }
}

async function handleInteraction(interaction: Interaction) {
    if(!interaction.isChatInputCommand()) return;

    switch(interaction.commandName) {
        case "search":
            searchCommand(interaction)
            break;
    }
}

async function searchCommand(interaction: Interaction) {
    if(!interaction.isChatInputCommand()) return;

    let query = interaction.options.getString("search")
    let results = await performSearch({search: query, limit: "3", page: "0"})
    interaction.reply({
        embeds: results.documents.map(doc => ({
            title: doc.title,
            url: `https://mccreations.net/${doc.type.toLowerCase()}s/${doc.slug}`,
            image: {
                url: doc.images[0]
            },
            author: {
                name: doc.creators?.map(creator => creator.username).join(", ")
            }
        }))
    })
}

async function createCommand(interaction: Interaction) {
    if(!interaction.isChatInputCommand()) return;

    let type = interaction.options.getString("type")
    let title = interaction.options.getString("title")
    let summary = interaction.options.getString("summary")

    if(!type || !title || !summary) {
        interaction.reply({content: "All fields are required"})
        return;
    }
    
    // let result = await uploadContent(type, {content: {title: title, summary: summary}})
    
    interaction.reply({content: "This command is not yet supported"})
    
}

let creationsToPost: ContentDocument[] = []
let runID: NodeJS.Timeout | undefined = undefined

export async function postNewCreation(creation: ContentDocument, message: string) {
    creationsToPost.push(creation)

    if(runID) {
        clearTimeout(runID)
    }

    runID = setTimeout(() => {
        runID = undefined
        let embeds = creationsToPost.map(creation => {
            return {
                title: creation.title,
                url: `https://mccreations.net/${creation.type.toLowerCase()}s/${creation.slug}`,
                description: creation.shortDescription + ` https://mccreations.net/${creation.type.toLowerCase()}s/${creation.slug}`,
                image: {
                    url: creation.images[0]
                },
                author: {
                    name: creation.creators?.map(creator => creator.username).join(", ") ?? "Unknown"
                }
            }
        })

        client.channels.fetch("1032320126978113636").then(channel => {
            if(channel && channel.isTextBased() && channel.type === ChannelType.GuildAnnouncement) {
                for(let i = 0; i < embeds.length; i += 10) {
                    channel.send({
                        content: message,
                        embeds: embeds.slice(i, i + 10)
                    })
                    message = ""
                }
            } else {
                console.log("Channel not found")
            }
        }).catch(console.log)
    

        creationsToPost = []
    }, 60 * 1000)
}

export async function sendMessage(message: string, channel: string) {
    client.channels.fetch(channel).then(channel => {
        if(channel && channel.isTextBased() && channel.type === ChannelType.GuildAnnouncement) {
            channel.send(message)
        }
    }).catch(console.log)
}