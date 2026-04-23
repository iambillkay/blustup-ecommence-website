const jwt = require("jsonwebtoken");

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (String(process.env.NODE_ENV || "").trim().toLowerCase() === "production") {
    return requiredEnv("JWT_SECRET");
  }
  return "blustup-local-dev-secret-change-me";
}

function getJwtExpiresIn() {
  // Example: "7d", "1h", etc
  return process.env.JWT_EXPIRES_IN || "7d";
}

function signJwt(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: getJwtExpiresIn() });
}

function verifyJwt(token) {
  return jwt.verify(token, getJwtSecret());
}

module.exports = { signJwt, verifyJwt };
