const s3 = require('aws-sdk/clients/s3');
const fs = require('fs')
// const FileReader = require('FileReader')
const papa = require('papaparse')
const { Readable } = require("stream");
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "***REMOVED***";
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const bucket = new s3({
    region: 'us-west-1',
    accessKeyId: "***REMOVED***",
    secretAccessKey: "***REMOVED***"
});

const collection = client.db('content').collection('Maps')

async function upload(file, name) {
    const params = {
        Bucket: 'mccreations',
        Key: name,
        Body: file
    }
    try {
        const u = bucket.upload(params);
        await u.promise().catch(error => {
            console.error(error)
        });
        console.log("Uploaded " + name);
    } catch (error) {
        return error;
    }
}

class Map {
    comments = [];
    creators = [];
    description = "";
    downloads = 0;
    files = [];
    images = [];
    shortDescription = "";
    slug = "";
    status = 0;
    title = "";
    videoUrl = "";
    views = 0;
    rating = 0
    createdDate = "";
    updatedDate = new Date();

    convertToJSON() {
        return {
            comments: this.comments,
            creators: this.creators,
            description: this.description,
            files: this.files,
            images: this.images,
            shortDescription: this.shortDescription,
            slug: this.slug,
            status: this.status,
            title: this.title,
            videoUrl: this.videoUrl,
            downloads: this.downloads,
            views: this.views,
            rating: this.rating,
            createdDate: this.createdDate,
            updatedDate: this.updatedDate
        }
    }
}

class File {
    minecraftVersion = "";
    type = "";
    worldUrl = "";
    resourceUrl = "";
    contentVersion = ""

    convertToJSON() {
        return {
            type: this.type,
            worldUrl: this.worldUrl,
            resourceUrl: this.resourceUrl,
            minecraftVersion: this.minecraftVersion,
            contentVersion: this.contentVersion
        }
    }
}

let file = fs.readFileSync("./content.csv", "utf-8")

var maps = []

let expectedImageLength = "f32145_1825ae2d040d45338e35607e3341749e~mv2.png".length

let data = papa.parse(file, {
    dynamicTyping: true,
    complete: function(results, file) {

        for(content of results.data) {
            if(content[15] != "Map") continue;
            let currMap = new Map();
            let currMapFile = new File();
            currMap.title = content[0]
            currMap.status = content[1] + 1
            currMapFile.minecraftVersion = content[2]
            currMapFile.worldUrl = content[3]
            currMapFile.resourceUrl = content[4]
            currMap.description = content[5]
            currMap.videoUrl = content[6],
            currMap.createdDate = content[8]
            currMap.updatedDate = new Date(content[9])
            if(content[10] === true) {
                currMap.status = 3
            }
            try {
                let imageString = content[12].substring(content[12].indexOf("/")+ 5, content[12].lastIndexOf("/"))
                while(imageString.includes("/")) {
                    imageString = imageString.substring(0, imageString.lastIndexOf('/'))
                }
                if(imageString.length < expectedImageLength) {
                    continue;
                }
                currMap.images.push("http://static.wixstatic.com/media/" + imageString)
            } catch (e) {
                continue;
            }
            let imageArray = content[11].split(",");
            for(let i = 0; i < imageArray.length; i++) {
                if (!imageArray[i].includes('image')) continue;
                imageString = imageArray[i].substring(imageArray[i].indexOf("/")+ 5, imageArray[i].lastIndexOf("/"))
                while(imageString.includes("/")) {
                    imageString = imageString.substring(0, imageString.lastIndexOf('/'))
                }
                if(imageString.length < expectedImageLength) {
                    continue;
                }
                currMap.images.push("http://static.wixstatic.com/media/" + imageString)
            }
            currMap.shortDescription = content[13]
            currMap.creators.push({username: content[14]})
            currMap.slug = content[18].substring(content[18].lastIndexOf("/")+1)
            currMap.slug = currMap.slug.replace("%5E", "^")
            currMap.slug = currMap.slug.replace("%3A", ":")
            currMap.slug = currMap.slug.replace("%2C", ",")
            currMap.slug = currMap.slug.replace("%5D", "]")
            currMap.slug = currMap.slug.replace("%5B", "[")
            currMap.downloads = content[20]
            currMapFile.contentVersion = content[23]
            currMap.files.push(currMapFile.convertToJSON());
            maps.push(currMap.convertToJSON())
        }
    }
})

fetchImages();

async function fetchImages() {
    for(map of maps) {

        for(let i = 0; i < map.images.length; i++) {
            let response = await fetch(map.images[i]);
            let buffer = await response.arrayBuffer();
            upload(new Uint8Array(buffer), `${map.slug}_image_${i}${map.images[i].substring(map.images[i].lastIndexOf('.'))}`);
            map.images[i] = `https://mccreations.s3.us-west-1.amazonaws.com/${map.slug}_image_${i}${map.images[i].substring(map.images[i].lastIndexOf('.'))}`
            console.log(map.images[i])
        }
    }
    insert();
}

async function updateMaps() {
    for(map of maps) {

        const filter = {
            slug: map.slug
        }

        const update = {
            $set: {
                images: map.images
            }
        }
        await collection.updateOne(filter, update)
        console.log("Updated " + map.slug)
    }
}


async function insert() {
    const result = await collection.insertMany(maps);
    console.log(result.insertedCount);
    return;
}