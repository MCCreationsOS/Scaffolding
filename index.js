// import { Database } from './db/connect'
const Database = require('./db/connect');
// import { initializeMapRoutes } from './maps/routes'

const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const fs = require('fs')
var http = require('http');
var https = require('https');
var privateKey  = fs.readFileSync('/etc/letsencrypt/live/api.mccreations.net/privkey.pem', 'utf8');
var certificate = fs.readFileSync('/etc/letsencrypt/live/api.mccreations.net/fullchain.pem', 'utf8');

var credentials = {key: privateKey, cert: certificate};
const app = express();
app.use(helmet());
app.use(bodyParser.json());
app.use(cors());
app.use(morgan('combined'));

client = new Database().client

initializeMapRoutes();

app.get('/maps/getCount', async (req, res) => {
	const collection = client.db("content").collection("Maps")
	let projection = {
		_id: 1
	}
	let cursor = collection.find({}).project(projection);
	let count = 0
	for await (const doc of cursor) {
		count++;
	}
	res.send({count: count});
})

app.get('/content/playlist/:name', async (req, res, next) => {
	const collection = client.db.collection("Maps")
	let cursor = collection.find({playlists: {$elemMatch: { $eq: req.params.name}}}).sort({createdDate: -1})
	let documents = []
	for await (const doc of cursor) {
		documents.push(doc)
	}
	res.send(documents)
})

app.post('/maps/rate/:slug', async (req, res, next) => {
	const collection = client.db("content").collection("Maps")
	let map = req.body.map
	
	// Calculate new rating
	let rating = 0;
	let ratings = map.ratings;
	let rates = 1;
	if(ratings) {
		rates = map.ratings.length + 1;
		ratings.push(Number.parseFloat(req.body.rating))
	} else {
		ratings = [Number.parseFloat(req.body.rating)]
	}

	for(let i = 0; i < rates; i++) {
		rating += ratings[i];
	}
	rating = rating/(rates + 0.0);

	collection.updateOne({slug: map.slug}, {$push: {ratings: Number.parseFloat(req.body.rating)}, $set : {rating: rating}}).then((result) => {
		res.send({rating: rating})
	}).catch((error) => {
		console.error(error)
		res.sendStatus(500);
	})
})

app.post('/maps/comment/:slug', async (req, res) => {
	const collection = client.db("content").collection("Maps")

	collection.updateOne({slug: req.params.slug}, {$push: {comments: {username: req.body.username, comment: req.body.comment, date: Date.now(), likes: 0, comments: {}}}})
	res.sendStatus(200)
})

app.get('/users', (req, res, next) => {
	fs.readFile('temp_data/users.json', 'utf-8', (err, data) => {
		let parsed = JSON.parse(data);
		res.send(parsed)
	})
})

app.get('/image', (req, res) => {
	fs.readFile('images/BP_Thumbnail_0.jpg', 'base64', (err, data) => {
		let json = {
			image: data
		}
		res.send(json);
	})
})

var httpServer = http.createServer(app);
var httpsServer = https.createServer(credentials, app);

httpServer.listen(80);
httpsServer.listen(443);