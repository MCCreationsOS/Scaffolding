import { initializeDiscordBot } from "./discord/bot";
import { Router } from "./routes/router";
import { Search } from "./search";

Search.refreshDatabase()
Router.initialize()
initializeDiscordBot()

import "./scheduled/refresh_search"