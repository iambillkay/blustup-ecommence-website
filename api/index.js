module.exports = async (req, res) => {
  try {
    const { prepareApp } = require("../server/bootstrap");
    const app = await prepareApp();
    return app(req, res);
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    console.error("Vercel API Initialization Error:", {
      message: error?.message,
      stack: error?.stack,
      status
    });
    return res.status(status).json({
      ok: false,
      error: error?.publicMessage || error?.message || "Failed to initialize application",
    });
  }
};
