const fs = require("fs");
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const productRoutes = require("./routes/products");
const cmsRoutes = require("./routes/cms");
const aiRoutes = require("./routes/ai");
const trackingRoutes = require("./routes/tracking");
const orderRoutes = require("./routes/orders");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const rootDir = path.join(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const publicIndexFile = path.join(publicDir, "index.html");
const isVercelDeployment = Boolean(process.env.VERCEL);
const frontendIndexFile = isVercelDeployment && fs.existsSync(publicIndexFile)
  ? publicIndexFile
  : path.join(rootDir, "index.html");

const app = express();

const configuredCorsOrigins = String(process.env.CORS_ORIGINS || "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

function isAllowedCorsOrigin(origin) {
  if (!origin) return true;

  const normalized = String(origin).trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === "null") return true;
  if (configuredCorsOrigins.includes(normalized)) return true;

  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalized);
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin(origin, callback) {
    if (isAllowedCorsOrigin(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));

// Vercel serves static files from public/**, but local development should continue
// preferring the existing root-level files while the repo transitions.
if (isVercelDeployment) app.use(express.static(publicDir));
app.use(express.static(rootDir));
if (!isVercelDeployment) app.use(express.static(publicDir));

// Uploads (image URL support)
if (isVercelDeployment) app.use("/uploads", express.static(path.join(publicDir, "uploads")));
app.use("/uploads", express.static(path.join(rootDir, "uploads")));
if (!isVercelDeployment) app.use("/uploads", express.static(path.join(publicDir, "uploads")));

// API
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cms", cmsRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/tracking", trackingRoutes);
app.use("/api/orders", orderRoutes);

// SPA-ish fallback: serve index for unknown routes (except /api)
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(frontendIndexFile);
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;

