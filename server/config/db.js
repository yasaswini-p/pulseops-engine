// Database connection — the app connects as the least-privilege user pulse_app
const { MongoClient } = require("mongodb");

let client = null;
let db = null;

async function connect() {
  client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  db = client.db(process.env.DB_NAME || "pulseops");
  return db;
}

function getDb() {
  if (!db) throw new Error("Database not connected. Call connect() first.");
  return db;
}

async function close() {
  if (client) await client.close();
}

module.exports = { connect, getDb, close };