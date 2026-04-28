require("dotenv").config();

const app = require("./app");
const { connectDB } = require("./config/db");
const { seedAdminIfConfigured } = require("./config/seedAdmin");
const { seedCatalogIfEmpty } = require("./config/seedCatalog");
const { backfillMongoStorefrontFromMemoryState } = require("./config/seedStorefrontFromMemoryState");
const storage = require("./storage");
const { startReportScheduler } = require("./services/reportScheduler");

let preparePromise = null;

async function prepareApp() {
  if (preparePromise) return preparePromise;

  preparePromise = (async () => {
    if (storage.mode === "mongo") {
      console.log("[bootstrap] Connecting to MongoDB...");
      await connectDB();
      
      console.log("[bootstrap] Running memory state backfill...");
      await backfillMongoStorefrontFromMemoryState();
      
      console.log("[bootstrap] Seeding admin if needed...");
      await seedAdminIfConfigured();
      
      console.log("[bootstrap] Seeding catalog if empty...");
      await seedCatalogIfEmpty();
      console.log("[bootstrap] Mongo initialization complete.");
    } else if (typeof storage.ensureAdminSeed === "function") {
      await storage.ensureAdminSeed();
    }

    // Vercel functions are ephemeral, so long-running cron tasks should only
    // start in the persistent local/server process.
    if (!process.env.VERCEL) await startReportScheduler();

    return app;
  })();

  try {
    return await preparePromise;
  } catch (error) {
    preparePromise = null;
    throw error;
  }
}

module.exports = { app, prepareApp };
