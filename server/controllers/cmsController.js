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
  userPersona: z.string().trim().min(1).max(160).optional().default("everyday online shoppers in Ghana who want reliable value and clear guidance"),
  systemPrompt: z.string().trim().min(1).max(2000),
});

const DEFAULT_AI_SETTINGS = {
  chatEnabled: true,
  searchEnabled: true,
  botName: "Blustup AI",
  userPersona: "everyday online shoppers in Ghana who want reliable value and clear guidance",
  systemPrompt:
    "You are Blustup's shopping assistant. Give brief, direct answers. Recommend products when relevant.",
};

const dealsSchema = z.array(
  z.object({
    id: z.string().trim().min(1).max(60),
    name: z.string().trim().min(1).max(100),
    timerSeconds: z.number().int().min(1).max(365 * 24 * 60 * 60),
    seeMoreFilter: z.string().trim().min(1).max(40),
    sourceCategory: z.string().trim().min(1).max(40),
    sourceCategories: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
    maxItems: z.number().int().min(1).max(50),
    isActive: z.boolean(),
    /** If non-empty, home page shows these products (by id) instead of category filter */
    productIds: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
  })
).max(20);

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
  const seen = new Set();
  return {
    ...value,
    filters: (value.filters || [])
      .filter((f) => {
        const filterValue = String(f?.value || "").trim();
        const token = normalizeCategoryToken(filterValue);
        if (!filterValue || !token || seen.has(token)) return false;
        seen.add(token);
        return true;
      })
      .map((f) => ({
        label: String(f?.label || f?.value || "").trim(),
        value: String(f?.value || "").trim(),
        showInShop: f.showInShop !== false,
      })),
  };
}

function normalizeCategoryToken(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeCategoryList(value, fallbackValue, options = {}) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const seen = new Set();
  const categories = source
    .map((entry) => String(entry || "").trim())
    .filter((entry) => {
      const token = normalizeCategoryToken(entry);
      if (!entry || seen.has(token)) return false;
      seen.add(token);
      return true;
    });

  if (categories.length) return categories;
  if (options.allowEmpty) return [];

  const fallback = String(fallbackValue || "").trim();
  return fallback ? [fallback] : [];
}

function getProductCategories(product) {
  return normalizeCategoryList(product?.categories, product?.cat, { allowEmpty: true });
}

function humanizeCategoryValue(value) {
  return String(value || "")
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function getShopValidationContext() {
  const productData = await storage.product.listAdmin();
  const products = Array.isArray(productData?.products) ? productData.products : [];
  const categoryMap = new Map();

  products
    .filter((product) => product && product.isActive !== false)
    .forEach((product) => {
      getProductCategories(product).forEach((category) => {
        const token = normalizeCategoryToken(category);
        if (!category || !token || categoryMap.has(token)) return;
        categoryMap.set(token, category);
      });
    });

  const activeCategories = [...categoryMap.values()].sort((a, b) => a.localeCompare(b));
  return { activeCategories };
}

function normalizeShopForSave(value, context = {}) {
  const base = normalizeShop(value);
  const filters = [];
  const seen = new Set(["all"]);

  filters.push({ label: "All Products", value: "all", showInShop: true });

  (base.filters || []).forEach((filter) => {
    const filterValue = String(filter?.value || "").trim();
    const token = normalizeCategoryToken(filterValue);
    if (!filterValue || token === "all" || seen.has(token)) return;
    seen.add(token);
    filters.push({
      label: String(filter?.label || humanizeCategoryValue(filterValue)).trim() || humanizeCategoryValue(filterValue),
      value: filterValue,
      showInShop: filter?.showInShop !== false,
    });
  });

  (context.activeCategories || []).forEach((category) => {
    const filterValue = String(category || "").trim();
    const token = normalizeCategoryToken(filterValue);
    if (!filterValue || seen.has(token)) return;
    seen.add(token);
    filters.push({
      label: humanizeCategoryValue(filterValue),
      value: filterValue,
      showInShop: true,
    });
  });

  return {
    title: String(value?.title || "").trim(),
    subtitle: String(value?.subtitle || "").trim(),
    filters,
  };
}

function normalizeDeals(list) {
  return (list || []).map((d) => ({
    ...d,
    sourceCategories: normalizeCategoryList(d.sourceCategories, d.sourceCategory),
    sourceCategory: normalizeCategoryList(d.sourceCategories, d.sourceCategory)[0] || "",
    productIds: Array.isArray(d.productIds) ? d.productIds : [],
  }));
}

async function getDealsValidationContext() {
  const [productData, shopSettings] = await Promise.all([
    storage.product.listAdmin(),
    storage.cms.getShop(),
  ]);

  const products = Array.isArray(productData?.products) ? productData.products : [];
  const activeProducts = products.filter((product) => product && product.isActive !== false);
  const activeProductIds = new Set(activeProducts.map((product) => String(product.id)));
  const activeCategories = new Set(
    activeProducts.flatMap((product) => getProductCategories(product).map(normalizeCategoryToken)).filter(Boolean)
  );
  const filterValues = new Set(
    (Array.isArray(shopSettings?.filters) ? shopSettings.filters : [])
      .map((filter) => normalizeCategoryToken(filter?.value))
      .filter(Boolean)
  );
  filterValues.add("all");

  return { activeProducts, activeProductIds, activeCategories, filterValues };
}

function normalizeDealsForSave(list) {
  return normalizeDeals(list).map((deal) => {
    const maxItems = Math.max(1, Number(deal.maxItems || 1));
    const sourceCategories = normalizeCategoryList(deal.sourceCategories, deal.sourceCategory);
    return {
      ...deal,
      sourceCategory: sourceCategories[0] || String(deal.sourceCategory || "").trim(),
      sourceCategories,
      seeMoreFilter: String(deal.seeMoreFilter || "").trim(),
      productIds: [...new Set((deal.productIds || []).map((id) => String(id).trim()).filter(Boolean))].slice(0, maxItems),
    };
  });
}

function validateDeals(list, context) {
  for (const deal of list) {
    const sourceCategories = normalizeCategoryList(deal.sourceCategories, deal.sourceCategory);
    if (!sourceCategories.length) {
      return `Deal "${deal.name}" needs at least one source category.`;
    }

    const invalidCategory = sourceCategories.find(
      (category) => !context.activeCategories.has(normalizeCategoryToken(category))
    );
    if (invalidCategory) {
      return `Deal "${deal.name}" includes a source category that does not match an active product category.`;
    }

    if (!context.filterValues.has(normalizeCategoryToken(deal.seeMoreFilter))) {
      return `Deal "${deal.name}" needs a valid shop filter for the "See more" link.`;
    }

    const invalidProductId = (deal.productIds || []).find((id) => !context.activeProductIds.has(String(id)));
    if (invalidProductId) {
      return `Deal "${deal.name}" includes a missing or inactive featured product.`;
    }

    if (!deal.productIds.length) {
      const hasFallbackProducts = context.activeProducts.some(
        (product) => getProductCategories(product).some(
          (category) => sourceCategories.some(
            (sourceCategory) => normalizeCategoryToken(category) === normalizeCategoryToken(sourceCategory)
          )
        )
      );
      if (!hasFallbackProducts) {
        return `Deal "${deal.name}" has no active products in the selected source categories.`;
      }
    }
  }

  return null;
}

function normalizeAiSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    chatEnabled: source.chatEnabled !== false,
    searchEnabled: source.searchEnabled !== false,
    botName: String(source.botName || DEFAULT_AI_SETTINGS.botName).trim() || DEFAULT_AI_SETTINGS.botName,
    userPersona:
      String(source.userPersona || DEFAULT_AI_SETTINGS.userPersona).trim() || DEFAULT_AI_SETTINGS.userPersona,
    systemPrompt:
      String(source.systemPrompt || DEFAULT_AI_SETTINGS.systemPrompt).trim() || DEFAULT_AI_SETTINGS.systemPrompt,
  };
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
  const [settings, context] = await Promise.all([
    storage.cms.getShop(),
    getShopValidationContext(),
  ]);
  return res.json({ settings: normalizeShopForSave(settings, context) });
}
async function setShop(req, res) {
  const parsed = shopSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
  const context = await getShopValidationContext();
  const settings = await storage.cms.setShop(normalizeShopForSave(parsed.data, context));
  return res.json({ settings });
}

async function getAi(_req, res) {
  return res.json({ settings: normalizeAiSettings(await storage.cms.getAi()) });
}
async function setAi(req, res) {
  const parsed = aiSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
  const settings = await storage.cms.setAi(normalizeAiSettings(parsed.data));
  return res.json({ settings });
}

async function getDeals(_req, res) {
  return res.json({ settings: normalizeDeals(await storage.cms.getDeals()) });
}
async function setDeals(req, res) {
  const parsed = dealsSchema.safeParse(req.body || []);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
  const nextDeals = normalizeDealsForSave(parsed.data);
  const context = await getDealsValidationContext();
  const validationError = validateDeals(nextDeals, context);
  if (validationError) return res.status(400).json({ error: validationError });

  const settings = await storage.cms.setDeals(nextDeals);
  await storage.audit.add({
    actorId: req.user?.sub || null,
    action: "change",
    entityType: "deals",
    entityId: null,
    summary: `Updated deals: ${nextDeals.length} configured`,
  });
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
