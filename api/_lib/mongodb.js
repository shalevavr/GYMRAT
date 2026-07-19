const { MongoClient } = require('mongodb');

let client;
let clientPromise;

function getConfig() {
  return {
    uri: process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URL || '',
    database: process.env.MONGODB_DB_NAME || process.env.MONGODB_DATABASE || 'SportDB',
    collection: process.env.MONGODB_COLLECTION || process.env.MONGODB_COLLECTION_NAME || 'user_data',
  };
}

function getClient() {
  const { uri } = getConfig();

  if (!uri) {
    throw new Error('Missing MongoDB configuration. Set MONGODB_URI in Vercel.');
  }

  if (!clientPromise) {
    client = new MongoClient(uri);
    clientPromise = client.connect();
  }

  return clientPromise;
}

async function getCollection() {
  const { database, collection } = getConfig();
  const connectedClient = await getClient();
  return connectedClient.db(database).collection(collection);
}

async function findOne(filter) {
  const collection = await getCollection();
  return collection.findOne(filter);
}

async function findMany(filter, options = {}) {
  const collection = await getCollection();
  const cursor = collection.find(filter, options);
  return cursor.toArray();
}

async function insertOne(document) {
  const collection = await getCollection();
  return collection.insertOne(document);
}

async function updateOne(filter, update, options = {}) {
  const collection = await getCollection();
  return collection.updateOne(filter, update, options);
}

async function deleteOne(filter) {
  const collection = await getCollection();
  return collection.deleteOne(filter);
}

module.exports = {
  getConfig,
  findOne,
  findMany,
  insertOne,
  deleteOne,
  updateOne,
};
