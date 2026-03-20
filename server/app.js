const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const productRoutes = require("./routes/products");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const rootDir = path.join(__dirname, "..");

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));

// Static frontend + assets
app.use(express.static(rootDir));

// Uploads (image URL support)
app.use("/uploads", express.static(path.join(rootDir, "uploads")));

// API
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/products", productRoutes);

// SPA-ish fallback: serve index for unknown routes (except /api)
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(rootDir, "index.html"));
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;

