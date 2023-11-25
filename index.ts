import * as fs from 'fs';
import express from 'express';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { initializeCommunityRoutes } from './community/routes.js';
import { initializeMapRoutes } from './maps/routes.js';

var privateKey = fs.readFileSync('/etc/letsencrypt/live/api.mccreations.net/privkey.pem', 'utf8');
var certificate = fs.readFileSync('/etc/letsencrypt/live/api.mccreations.net/fullchain.pem', 'utf8');
var credentials = {key: privateKey, cert: certificate};

export const app = express();
app.use(helmet());
app.use(bodyParser.json())
app.use(cors());
app.use(morgan('combined'));

initializeCommunityRoutes();
initializeMapRoutes();

var httpServer = createHttpServer(app);
var httpsServer = createHttpsServer(credentials, app);

httpServer.listen(80);
httpsServer.listen(443);