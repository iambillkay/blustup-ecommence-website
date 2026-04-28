const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { z } = require("zod");

const storage = require("../storage");
const { signJwt } = require("../config/jwt");
const emailService = require("../services/emailService");

const signupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200).transform((v) => v.toLowerCase()),
  password: z.string().min(8).max(200),
  phone: z.string().trim().min(8).max(20),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(200).transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(200),
});

const adminLoginSchema = loginSchema;

function safeError(e) {
  if (e?.issues?.length) return e.issues[0]?.message || "Invalid input";
  return e?.message || "Request failed";
}

function toAuthUser(user) {
  if (typeof storage.getAuthUserResponse === "function") {
    return storage.getAuthUserResponse(user);
  }
  return { id: user._id.toString(), name: user.name, email: user.email, role: user.role };
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function signup(req, res, next) {
  try {
    const body = signupSchema.parse(req.body || {});
    const existing = await storage.user.findByEmail(body.email);
    if (existing) return res.status(409).json({ error: "Email already in use" });

    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 12);
    const passwordHash = await bcrypt.hash(body.password, saltRounds);
    const verificationToken = generateToken();

    const user = await storage.user.create({
      name: body.name,
      email: body.email,
      passwordHash,
      role: "user",
      phone: (body.phone || "").trim() || null,
      emailVerified: false,
      verificationToken,
    });

    // Send verification email (non-blocking)
    emailService.sendVerificationEmail(user.email, verificationToken).catch((err) => {
      console.warn("Failed to send verification email:", err?.message);
    });

    const token = signJwt({ sub: user._id.toString(), email: user.email, name: user.name, role: user.role });
    return res.status(201).json({ token, user: toAuthUser(user) });
  } catch (e) {
    return res.status(400).json({ error: safeError(e) });
  }
}

async function login(req, res) {
  const body = loginSchema.safeParse(req.body || {});
  if (!body.success) return res.status(400).json({ error: safeError(body.error) });

  const { email, password } = body.data;
  const user = await storage.user.findByEmail(email);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signJwt({ sub: user._id.toString(), email: user.email, name: user.name, role: user.role });
  return res.json({ token, user: toAuthUser(user) });
}

async function me(req, res) {
  const user = await storage.user.findById(req.user.sub);
  if (!user) return res.status(404).json({ error: "Not found" });
  return res.json({ user: toAuthUser(user) });
}

async function adminLogin(req, res) {
  const body = adminLoginSchema.safeParse(req.body || {});
  if (!body.success) return res.status(400).json({ error: safeError(body.error) });

  const { email, password } = body.data;
  const user = await storage.user.findByEmail(email);
  if (!user || user.role !== "admin") return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signJwt({ sub: user._id.toString(), email: user.email, name: user.name, role: user.role });
  return res.json({ token, user: toAuthUser(user) });
}

async function forgotPassword(req, res) {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "Email is required" });

  // Always return success to avoid email enumeration
  const successMsg = "If an account with that email exists, a reset link has been sent.";

  try {
    const User = require("../models/User");
    const user = await User.findOne({ email });
    if (!user) return res.json({ message: successMsg });

    const resetToken = generateToken();
    user.resetToken = resetToken;
    user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    await emailService.sendPasswordResetEmail(email, resetToken);
  } catch (err) {
    console.warn("Forgot password error:", err?.message);
  }

  return res.json({ message: successMsg });
}

async function resetPassword(req, res) {
  const token = String(req.body?.token || "").trim();
  const newPassword = String(req.body?.password || "");

  if (!token) return res.status(400).json({ error: "Reset token is required" });
  if (newPassword.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

  try {
    const User = require("../models/User");
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() },
    });

    if (!user) return res.status(400).json({ error: "Invalid or expired reset link. Please request a new one." });

    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 12);
    user.passwordHash = await bcrypt.hash(newPassword, saltRounds);
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    return res.json({ message: "Password has been reset. You can now sign in with your new password." });
  } catch (err) {
    return res.status(500).json({ error: "Failed to reset password" });
  }
}

async function verifyEmail(req, res) {
  const token = String(req.query?.token || req.body?.token || "").trim();
  if (!token) return res.status(400).json({ error: "Verification token is required" });

  try {
    const User = require("../models/User");
    const user = await User.findOne({ verificationToken: token });
    if (!user) return res.status(400).json({ error: "Invalid or expired verification link." });

    user.emailVerified = true;
    user.verificationToken = null;
    await user.save();

    return res.json({ message: "Email verified successfully! You can now use all features." });
  } catch (err) {
    return res.status(500).json({ error: "Verification failed" });
  }
}

module.exports = { signup, login, me, adminLogin, forgotPassword, resetPassword, verifyEmail };
