require("dotenv").config();

const app = require("./app");
const { connectDB } = require("./config/db");
const { seedAdminIfConfigured } = require("./config/seedAdmin");
const storage = require("./storage");
const { startReportScheduler } = require("./services/reportScheduler");

const port = Number(process.env.PORT || 3000);

async function start() {
  if (storage.mode === "mongo") {
    await connectDB();
    await seedAdminIfConfigured();
  } else {
    await storage.ensureAdminSeed();
  }
  await startReportScheduler();
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

start().catch((e) => {
  console.error("Failed to start:", e?.message || e);
  process.exit(1);
});
