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
        /** When false, filter is kept for admin/deals but hidden on the shop UI */
        showInShop: z.boolean().optional(),
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
    /** If non-empty, home page shows these products (by id) instead of category filter */
    productIds: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
  })
).min(1).max(20);

const faqSchema = z.object({
  pageTitle: z.string().trim().min(1).max(120),
  label: z.string().trim().max(80).optional(),
  intro: z.string().trim().max(500).optional(),
  helpTitle: z.string().trim().min(1).max(120),
  helpText: z.string().trim().min(1).max(800),
  contactEmail: z.union([z.string().email().max(120), z.literal("")]).optional(),
  faqs: z
    .array(
      z.object({
        question: z.string().trim().min(1).max(300),
        answer: z.string().trim().min(1).max(2000),
      })
    )
    .max(50),
  boardTitle: z.string().trim().min(1).max(120),
  board: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        role: z.string().trim().min(1).max(120),
        bio: z.string().trim().min(1).max(800),
        imageUrl: z.union([z.string().trim().max(500), z.literal(""), z.null()]).optional(),
      })
    )
    .max(20),
});

function normalizeShop(value) {
  return {
    ...value,
    filters: (value.filters || []).map((f) => ({
      ...f,
      showInShop: f.showInShop !== false,
    })),
  };
}

function normalizeDeals(list) {
  return (list || []).map((d) => ({
    ...d,
    productIds: Array.isArray(d.productIds) ? d.productIds : [],
  }));
}

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
  return res.json({ settings: normalizeShop(await storage.cms.getShop()) });
}
async function setShop(req, res) {
  const parsed = shopSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
  const settings = await storage.cms.setShop(normalizeShop(parsed.data));
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
  return res.json({ settings: normalizeDeals(await storage.cms.getDeals()) });
}
async function setDeals(req, res) {
  const parsed = dealsSchema.safeParse(req.body || []);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
  const settings = await storage.cms.setDeals(normalizeDeals(parsed.data));
  return res.json({ settings });
}

async function getFaq(_req, res) {
  return res.json({ settings: await storage.cms.getFaq() });
}
async function setFaq(req, res) {
  const parsed = faqSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
  const settings = await storage.cms.setFaq(parsed.data);
  return res.json({ settings });
}

async function uploadHomeImage(req, res) {
  if (!req.file) return res.status(400).json({ error: "Image file is required" });
  return res.status(201).json({ imageUrl: `/uploads/${req.file.filename}` });
}

async function uploadCmsImage(req, res) {
  if (!req.file) return res.status(400).json({ error: "Image file is required" });
  return res.status(201).json({ imageUrl: `/uploads/${req.file.filename}` });
}

module.exports = {
  getHome,
  setHome,
  getShop,
  setShop,
  getAi,
  setAi,
  getDeals,
  setDeals,
  getFaq,
  setFaq,
  uploadHomeImage,
  uploadCmsImage,
};
