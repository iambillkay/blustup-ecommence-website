const { prepareApp } = require("../server/bootstrap");

module.exports = async (req, res) => {
  try {
    const app = await prepareApp();
    return app(req, res);
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    console.error("Failed to initialize Vercel app:", error?.stack || error?.message || error);
    return res.status(status).json({
      ok: false,
      error: error?.publicMessage || "Failed to initialize application",
    });
  }
};
