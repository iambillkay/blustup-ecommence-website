const mongoose = require("mongoose");

let isConnected = false;

async function connectDB() {
  if (isConnected) return;
  // Default to local MongoDB for beginner-friendly setup.
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/blustup";

  // `strictQuery` reduces warnings and keeps queries consistent.
  await mongoose.connect(uri, { autoIndex: true });
  isConnected = true;
}

module.exports = { connectDB };

