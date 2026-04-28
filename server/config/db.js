const mongoose = require("mongoose");

let isConnected = false;

function readPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createConfigError(message, publicMessage) {
  const error = new Error(message);
  error.status = 503;
  error.publicMessage = publicMessage;
  return error;
}

function resolveMongoUri() {
  const configuredUri = String(process.env.MONGODB_URI || "").trim();
  if (configuredUri) return configuredUri;

  const storageMode = String(process.env.STORAGE_MODE || "").trim().toLowerCase();
  const isProductionLike =
    storageMode === "mongo" ||
    process.env.VERCEL ||
    process.env.NODE_ENV === "production";

  if (isProductionLike) {
    throw createConfigError(
      "Missing MONGODB_URI while Mongo storage is enabled.",
      "Database configuration is missing. Add MONGODB_URI to your server environment.",
    );
  }

  // Default to local MongoDB for beginner-friendly setup.
  return "mongodb://127.0.0.1:27017/blustup";
}

async function connectDB() {
  if (isConnected) return;
  const uri = resolveMongoUri();

  // `strictQuery` reduces warnings and keeps queries consistent.
  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(uri, {
      autoIndex: true,
      serverSelectionTimeoutMS: readPositiveInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS, 15000),
      connectTimeoutMS: readPositiveInt(process.env.MONGODB_CONNECT_TIMEOUT_MS, 15000),
    });
    isConnected = true;
  } catch (error) {
    throw createConfigError(
      `MongoDB connection failed: ${error?.message || error}`,
      "Database connection failed. Check MONGODB_URI and your MongoDB Atlas network access settings.",
    );
  }
}

module.exports = { connectDB };
