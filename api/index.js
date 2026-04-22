const { prepareApp } = require("../server/bootstrap");

module.exports = async (req, res) => {
  try {
    const app = await prepareApp();
    return app(req, res);
  } catch (error) {
    console.error("Failed to initialize Vercel app:", error?.message || error);
    return res.status(500).json({
      ok: false,
      error: "Failed to initialize application",
    });
  }
};
