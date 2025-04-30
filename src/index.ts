import { initializeDiscordBot } from "./discord/bot";
import { Router } from "./routes/router";
import { Search } from "./search";

Search.initialize()
Router.initialize()
initializeDiscordBot()