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
import { initializeAuthRoutes } from './auth/routes.js';
import { MongoClient, ServerApiVersion } from 'mongodb';
import { initializeContentRoutes } from './content/routes.js';

let credentials;

try {
    var privateKey = fs.readFileSync('/etc/letsencrypt/live/api.mccreations.net/privkey.pem', 'utf8');
    var certificate = fs.readFileSync('/etc/letsencrypt/live/api.mccreations.net/fullchain.pem', 'utf8');
    credentials = {key: privateKey, cert: certificate};
} catch(e) {

}

export const app = express();
app.use(helmet());
app.use(bodyParser.json())
app.use(cors());
app.use(morgan('combined'));

const uri = "***REMOVED***";
export const client = new MongoClient(uri);

initializeCommunityRoutes();
initializeMapRoutes();
initializeAuthRoutes();
initializeContentRoutes();

var httpServer = createHttpServer(app);
httpServer.listen(8080);

// if(credentials) {
//     var httpsServer = createHttpsServer(credentials, app);
//     httpsServer.listen(443);
// }
