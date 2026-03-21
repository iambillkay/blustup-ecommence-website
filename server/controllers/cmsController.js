const { z } = require("zod");
const storage = require("../storage");

const homeSchema = z.object({
  adImages: z.array(z.string().trim().min(1).max(500)).min(1).max(10),
});

const shopSchema = z.object({
  title: z.string().trim().min(1).max(120),
  subtitle: z.string().trim().min(1).max(220),
  filters: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(40),
        value: z.string().trim().min(1).max(40),
      })
    )
    .min(1)
    .max(20),
});

const aiSchema = z.object({
  chatEnabled: z.boolean(),
  searchEnabled: z.boolean(),
  botName: z.string().trim().min(1).max(60),
  systemPrompt: z.string().trim().min(1).max(2000),
});

const dealsSchema = z.array(
  z.object({
    id: z.string().trim().min(1).max(60),
    name: z.string().trim().min(1).max(100),
    timerSeconds: z.number().int().min(1).max(365 * 24 * 60 * 60),
    seeMoreFilter: z.string().trim().min(1).max(40),
    sourceCategory: z.string().trim().min(1).max(40),
    maxItems: z.number().int().min(1).max(50),
    isActive: z.boolean(),
  })
).min(1).max(20);

async function getHome(_req, res) {
  return res.json({ settings: await storage.cms.getHome() });
}
async function setHome(req, res) {
  const parsed = homeSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
  const settings = await storage.cms.setHome(parsed.data);
  return res.json({ settings });
}

async function getShop(_req, res) {
  return res.json({ settings: await storage.cms.getShop() });
}
async function setShop(req, res) {
  const parsed = shopSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
  const settings = await storage.cms.setShop(parsed.data);
  return res.json({ settings });
}

async function getAi(_req, res) {
  return res.json({ settings: await storage.cms.getAi() });
}
async function setAi(req, res) {
  const parsed = aiSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
  const settings = await storage.cms.setAi(parsed.data);
  return res.json({ settings });
}

async function getDeals(_req, res) {
  return res.json({ settings: await storage.cms.getDeals() });
}
async function setDeals(req, res) {
  const parsed = dealsSchema.safeParse(req.body || []);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
  const settings = await storage.cms.setDeals(parsed.data);
  return res.json({ settings });
}

async function uploadHomeImage(req, res) {
  if (!req.file) return res.status(400).json({ error: "Image file is required" });
  return res.status(201).json({ imageUrl: `/uploads/${req.file.filename}` });
}

module.exports = { getHome, setHome, getShop, setShop, getAi, setAi, getDeals, setDeals, uploadHomeImage };

