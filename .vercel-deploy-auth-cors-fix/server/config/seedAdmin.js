const bcrypt = require("bcrypt");
const User = require("../models/User");

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

async function seedAdminIfConfigured() {
  const email = process.env.ADMIN_EMAIL;
  if (!email) return;

  // Allow either ADMIN_PASSWORD (recommended) or precomputed ADMIN_PASSWORD_HASH.
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  const password = process.env.ADMIN_PASSWORD;

  if (!passwordHash && !password) {
    throw new Error("Set ADMIN_PASSWORD or ADMIN_PASSWORD_HASH to seed the initial admin.");
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const existing = await User.findOne({ email: normalizedEmail }).select("_id role");
  if (existing) {
    // Ensure it's an admin.
    if (existing.role !== "admin") {
      existing.role = "admin";
      await existing.save();
    }
    return;
  }

  const role = "admin";
  const name = process.env.ADMIN_NAME ? String(process.env.ADMIN_NAME).trim() : "Admin";

  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 12);
  // If ADMIN_PASSWORD is provided, prefer it (easier local setup even if ADMIN_PASSWORD_HASH exists).
  const hash = password
    ? await bcrypt.hash(String(password), saltRounds)
    : passwordHash;

  await User.create({
    name,
    email: normalizedEmail,
    passwordHash: hash,
    role,
  });
}

module.exports = { seedAdminIfConfigured };

