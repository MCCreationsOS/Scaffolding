import * as fs from 'fs';
import express from 'express';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { createServer as createHttpServer } from 'http';
import { initializeCommunityRoutes } from './community/routes.js';
import { initializeMapRoutes } from './maps/routes.js';
import { initializeAuthRoutes } from './auth/routes.js';
import { MongoClient } from 'mongodb';
import { initializeContentRoutes } from './content/routes.js';
import { approvedEmail } from './email/email.js';
import { updateMeilisearch } from './meilisearch.js';

export const app = express();
app.use(helmet());
app.use(bodyParser.json())
app.use(cors());
app.use(morgan('combined'));

export const client = new MongoClient(process.env.MONGODB_URI + "");

/**
 * Routes are broken up into separate files based on the 'section' of the site they are for.
 * 
 * Content and maps should be combined at some point, as content encompasses maps.
 * Currently however, content handles creation, importing and editing of maps while maps handles fetching of map data only.
 */

initializeCommunityRoutes();
initializeMapRoutes();
initializeAuthRoutes();
initializeContentRoutes();

setInterval(updateMeilisearch, 1000 * 60 * 60 * 24);

var httpServer = createHttpServer(app);
httpServer.listen(8080);
