"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const fs = __importStar(require("fs"));
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const http_1 = require("http");
const https_1 = require("https");
const routes_1 = require("./community/routes");
const routes_2 = require("./maps/routes");
var privateKey = fs.readFileSync('/etc/letsencrypt/live/api.mccreations.net/privkey.pem', 'utf8');
var certificate = fs.readFileSync('/etc/letsencrypt/live/api.mccreations.net/fullchain.pem', 'utf8');
var credentials = { key: privateKey, cert: certificate };
exports.app = (0, express_1.default)();
exports.app.use((0, helmet_1.default)());
exports.app.use(body_parser_1.default.json());
exports.app.use((0, cors_1.default)());
exports.app.use((0, morgan_1.default)('combined'));
(0, routes_1.initializeCommunityRoutes)();
(0, routes_2.initializeMapRoutes)();
var httpServer = (0, http_1.createServer)(exports.app);
var httpsServer = (0, https_1.createServer)(credentials, exports.app);
httpServer.listen(80);
httpsServer.listen(443);
