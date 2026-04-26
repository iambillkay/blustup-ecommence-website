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
const paymentRoutes = require("./routes/payment");
const wishlistRoutes = require("./routes/wishlist");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const rootDir = path.join(__dirname, "..");
const frontendIndexFile = path.join(rootDir, "index.html");

const app = express();

const configuredCorsOrigins = String(process.env.CORS_ORIGINS || "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

function parseOrigin(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized === "null") return null;

  try {
    return new URL(normalized);
  } catch (_error) {
    return null;
  }
}

function normalizeConfiguredOrigin(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;

  const parsed = parseOrigin(normalized);
  if (parsed) {
    return { type: "origin", value: parsed.origin.toLowerCase() };
  }

  const bareHost = normalized.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return bareHost ? { type: "host", value: bareHost } : null;
}

const normalizedCorsOrigins = configuredCorsOrigins
  .map(normalizeConfiguredOrigin)
  .filter(Boolean);

function buildRequestOrigin(req) {
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").trim().toLowerCase();
  if (!host) return null;

  const protoHeader = String(req.headers["x-forwarded-proto"] || req.protocol || "http")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const proto = protoHeader || "http";
  return `${proto}://${host}`;
}

function matchesConfiguredOrigin(originUrl) {
  return normalizedCorsOrigins.some((entry) => {
    if (entry.type === "origin") return entry.value === originUrl.origin.toLowerCase();
    return entry.type === "host" && entry.value === originUrl.host.toLowerCase();
  });
}

function isAllowedCorsOrigin(origin, req) {
  if (!origin) return true;

  const parsedOrigin = parseOrigin(origin);
  if (!parsedOrigin) return true;

  const requestOrigin = buildRequestOrigin(req);
  if (requestOrigin && parsedOrigin.origin.toLowerCase() === requestOrigin) return true;
  if (matchesConfiguredOrigin(parsedOrigin)) return true;

  return /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(parsedOrigin.host);
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors((req, callback) => {
  const allowed = isAllowedCorsOrigin(req.headers.origin, req);
  if (allowed) {
    return callback(null, {
      origin: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    });
  }

  const error = new Error("Origin not allowed by CORS");
  error.status = 403;
  error.publicMessage = "Origin not allowed by CORS";
  return callback(error);
}));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));

// Serve static files from root
app.use(express.static(rootDir));

// Uploads (image URL support)
app.use("/uploads", express.static(path.join(rootDir, "uploads")));

// API
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cms", cmsRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/tracking", trackingRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/wishlist", wishlistRoutes);

// SPA-ish fallback: serve index for unknown routes (except /api)
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(frontendIndexFile);
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
