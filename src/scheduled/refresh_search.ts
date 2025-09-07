import { CronJob } from "schedule-jobs-with-cron";
import { Search } from "../search";

new CronJob("refreshSearch", Search.refreshDatabase, "0 0 * * *")