import { Database } from "./db/connect.js"

export async function updateMeilisearch() {
  const maps = new Database()
  const datapacks = new Database('content', 'datapacks')
  const resourcepacks = new Database('content', 'resourcepacks')

  let cursor = maps.collection.find({})
  let dcursor = datapacks.collection.find({})
  let rcursor = resourcepacks.collection.find({})

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

  let datapacksL = []
  for await (const doc of dcursor) {
      let timestampInMilliseconds = Date.parse(doc.createdDate);
      let timestamp = timestampInMilliseconds / 1000; 
      doc.createdDate = timestamp;

      timestampInMilliseconds = Date.parse(doc.updatedDate);
      timestamp = timestampInMilliseconds / 1000;
      doc.updatedDate = timestamp;
      datapacksL.push(doc);
  }

  let resourcesL = []
  for await (const doc of rcursor) {
      let timestampInMilliseconds = Date.parse(doc.createdDate);
      let timestamp = timestampInMilliseconds / 1000; 
      doc.createdDate = timestamp;

      timestampInMilliseconds = Date.parse(doc.updatedDate);
      timestamp = timestampInMilliseconds / 1000;
      doc.updatedDate = timestamp;
      resourcesL.push(doc)
  }

  fetch('http://localhost:7700/indexes/maps/documents?primaryKey=_id', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + process.env.MEILISEARCH_KEY
    },
    body: JSON.stringify(documents)
  })

  fetch('http://localhost:7700/indexes/datapacks/documents?primaryKey=_id', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + process.env.MEILISEARCH_KEY
    },
    body: JSON.stringify(datapacksL)
  })

  fetch('http://localhost:7700/indexes/resourcepacks/documents?primaryKey=_id', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + process.env.MEILISEARCH_KEY
    },
    body: JSON.stringify(resourcesL)
  })
}

