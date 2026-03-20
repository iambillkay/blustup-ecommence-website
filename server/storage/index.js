const storageMode =
  process.env.STORAGE_MODE ||
  (process.env.MONGODB_URI ? "mongo" : "memory");

if (storageMode === "mongo") {
  // Lazy import so memory mode doesn't require mongoose models.
  module.exports = require("./mongoStorage");
} else {
  module.exports = require("./memoryStorage");
}

