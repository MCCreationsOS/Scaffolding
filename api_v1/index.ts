import * as fs from 'fs';
import express from 'express';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { createServer as createHttpServer } from 'http';
import { initializeCommunityRoutes } from './community/routes.js';
import { initializeMapRoutes } from './content/maps/routes.js';
import { initializeAuthRoutes, refreshJWTHash } from './auth/routes.js';
import { MongoClient } from 'mongodb';
import { initializeContentRoutes } from './content/routes.js';
import { approvedEmail } from './email/email.js';
import { updateMeilisearch } from './meilisearch.js';

export const app = express();
app.use(helmet());
app.use(bodyParser.json())
app.use(cors());
app.use(morgan('combined'));

export const client = new MongoClient("mongodb+srv://app-test:%40pp-t$st@mccreations.454k0cx.mongodb.net/?retryWrites=true&w=majority&appName=mccreations");

/**
 * Routes are broken up into separate files based on the 'section' of the site they are for.
 * Even though all content routes live in the same content folder they each have their own initialization function.
 */

initializeCommunityRoutes();
initializeMapRoutes();
initializeAuthRoutes();
initializeContentRoutes();

setInterval(updateMeilisearch, 1000 * 60 * 60 * 24);
setInterval(refreshJWTHash, 1000 * 60 * 60 * 24 * 15);

var httpServer = createHttpServer(app);
httpServer.listen(8080);

