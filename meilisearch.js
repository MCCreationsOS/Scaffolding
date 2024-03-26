// const papa = require('papaparse')
import { Readable } from 'stream'
// const { Readable } = require("stream");
import { MongoClient, ServerApiVersion } from 'mongodb';
import pkg from 'aws-sdk';
import { writeFileSync } from 'fs';
const { S3 } = pkg;
// const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "***REMOVED***";
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const bucket = new S3({
    region: 'us-west-1',
    accessKeyId: "***REMOVED***",
    secretAccessKey: "***REMOVED***"
});

const collection = client.db('content').collection('Maps')

let cursor = collection.find({})

let documents = []
for await (const doc of cursor) {
    documents.push(doc);
}
writeFileSync('../meilisearch/maps.json', JSON.stringify(documents))