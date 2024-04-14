import { MongoClient, ServerApiVersion } from 'mongodb';
import { writeFileSync } from 'fs';
const client = new MongoClient(process.env.MONGO_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const collection = client.db('content').collection('Maps')

let cursor = collection.find({})

let documents = []
for await (const doc of cursor) {
    let timestampInMilliseconds = Date.parse(doc.createdDate);
    let timestamp = timestampInMilliseconds / 1000; 
    doc.createdDate = timestamp;

    timestampInMilliseconds = Date.parse(doc.updatedDate);
    timestamp = timestampInMilliseconds / 1000;
    doc.updatedDate = timestamp;
    documents.push(doc);
}


writeFileSync('./meilisearch/maps.json', JSON.stringify(documents))