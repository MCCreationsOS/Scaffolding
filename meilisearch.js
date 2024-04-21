import { MongoClient, ServerApiVersion } from 'mongodb';
const client = new MongoClient(process.env.MONGODB_URI, {
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

client.close();

fetch('http://localhost:7700/indexes/maps/documents?primaryKey=_id', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + process.env.MEILISEARCH_KEY
  },
  body: JSON.stringify(documents)
})