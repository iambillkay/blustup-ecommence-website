const bcrypt = require("bcrypt");
const { z } = require("zod");

const storage = require("../storage");
const { signJwt } = require("../config/jwt");

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

async function signup(req, res, next) {
  try {
    const body = signupSchema.parse(req.body || {});
    const existing = await storage.user.findByEmail(body.email);
    if (existing) return res.status(409).json({ error: "Email already in use" });

    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 12);
    const passwordHash = await bcrypt.hash(body.password, saltRounds);

    const user = await storage.user.create({
      name: body.name,
      email: body.email,
      passwordHash,
      role: "user",
      phone: (body.phone || "").trim() || null,
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

module.exports = { signup, login, me, adminLogin };
