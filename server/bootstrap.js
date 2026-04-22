require("dotenv").config();

const app = require("./app");
const { connectDB } = require("./config/db");
const { seedAdminIfConfigured } = require("./config/seedAdmin");
const storage = require("./storage");
const { startReportScheduler } = require("./services/reportScheduler");

let preparePromise = null;

async function prepareApp() {
  if (preparePromise) return preparePromise;

  preparePromise = (async () => {
    if (storage.mode === "mongo") {
      await connectDB();
      await seedAdminIfConfigured();
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
