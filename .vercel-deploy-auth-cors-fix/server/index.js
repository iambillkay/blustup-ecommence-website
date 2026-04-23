const { prepareApp } = require("./bootstrap");

const port = Number(process.env.PORT || 3000);

async function start() {
  const app = await prepareApp();
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

start().catch((e) => {
  console.error("Failed to start:", e?.stack || e?.message || e);
  process.exit(1);
});
