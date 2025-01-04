import * as fs from 'fs';
import express from 'express';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { createServer as createHttpServer } from 'http';
import { initializeCommunityRoutes, sendCommentsDigest } from './community/routes.js';
import { initializeMapRoutes } from './content/maps/routes.js';
import { initializeAuthRoutes, refreshJWTHash } from './auth/routes.js';
import { MongoClient } from 'mongodb';
import { initializeContentRoutes } from './content/routes.js';
import { approvedEmail } from './email/email.js';
import { updateMeilisearch } from './meilisearch.js';
import { initializeDatapackRoutes } from './content/datapacks/routes.js';
import { initializeResourcepackRoutes } from './content/resourcepacks/routes.js';
import { initializePaymentRoutes } from './payment/routes.js';
import { initializeDiscordBot } from '../discord_bot/index.js';
import { Search } from './db/connect.js';
import { initializeCreatorRoutes } from './creators/routes.js';
import { initializeNotificationRoutes } from './notifications/routes.js';
import { initializeTranslationRoutes } from './translation/routes.js';
import { sendDailyNotifications, sendWeeklyNotifications } from './notifications/index.js';
import schedule from 'schedule-jobs-with-cron';
import { initializeUploadRoutes } from './s3/upload.js';
export const app = express();
app.use(helmet());
app.use(bodyParser.json())
app.use(cors());
app.use(morgan('combined'));
app.set('trust proxy', true);

export const client = new MongoClient(process.env.MONGODB_URI + "");
/**
 * Routes are broken up into separate files based on the 'section' of the site they are for.
 * Even though all content routes live in the same content folder they each have their own initialization function.
 */

initializeCommunityRoutes();
initializeMapRoutes();
initializeAuthRoutes();
initializeContentRoutes();
initializeDatapackRoutes();
initializeResourcepackRoutes();
initializePaymentRoutes();
initializeDiscordBot();
initializeCreatorRoutes();
initializeNotificationRoutes();
initializeTranslationRoutes();
initializeUploadRoutes();


updateMeilisearch();
setInterval(updateMeilisearch, 1000 * 60 * 60 * 24);
setInterval(refreshJWTHash, 1000 * 60 * 60 * 24 * 15);
setInterval(sendCommentsDigest, 1000 * 60 * 60 * 24);

sendDailyNotifications()

const dailyJob = new schedule.CronJob("dailyJob", sendDailyNotifications, "5 12 * * *")
const weeklyJob = new schedule.CronJob("weeklyJob", sendWeeklyNotifications, "0 12 * * 1")

var httpServer = createHttpServer(app);
httpServer.listen(8080);
