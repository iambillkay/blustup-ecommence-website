const { z } = require("zod");
const storage = require("../storage");
const {
  normalizeHomeSettings,
  normalizeAboutSettings,
  normalizeAdminPageSettings,
} = require("../utils/cmsDefaults");

const homeSchema = z.object({
  adImages: z.array(z.string().trim().min(1).max(500)).max(10).optional(),
  ads: z.array(
    z.object({
      id: z.string().trim().min(1).max(60),
      imageUrl: z.string().trim().min(1).max(500),
      title: z.string().trim().min(1).max(140),
      subtitle: z.string().trim().max(220).optional(),
      ctaLabel: z.string().trim().max(40).optional(),
      ctaTarget: z.string().trim().max(200).optional(),
      isActive: z.boolean().optional(),
    })
  ).max(10).optional(),
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

const aboutSchema = z.object({
  badge: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(220),
  intro: z.string().trim().min(1).max(800),
  primaryCtaLabel: z.string().trim().min(1).max(40),
  primaryCtaTarget: z.string().trim().min(1).max(200),
  secondaryCtaLabel: z.string().trim().min(1).max(40),
  secondaryCtaTarget: z.string().trim().min(1).max(200),
  stats: z.array(
    z.object({
      title: z.string().trim().min(1).max(80),
      text: z.string().trim().min(1).max(220),
    })
  ).min(1).max(6),
  cards: z.array(
    z.object({
      title: z.string().trim().min(1).max(120),
      text: z.string().trim().min(1).max(900),
    })
  ).min(1).max(6),
  pillars: z.array(
    z.object({
      title: z.string().trim().min(1).max(120),
      items: z.array(z.string().trim().min(1).max(220)).min(1).max(8),
    })
  ).min(1).max(4),
});

const colorHexSchema = z.string().trim().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Use a valid hex color.");

const adminPageSchema = z.object({
  pageTitle: z.string().trim().min(1).max(80),
  logoImageUrl: z.union([z.string().trim().max(500), z.literal("")]),
  brandSubtitle: z.string().trim().min(1).max(80),
  sidebarStatus: z.string().trim().min(1).max(80),
  heroEyebrow: z.string().trim().min(1).max(80),
  heroTitleTemplate: z.string().trim().min(1).max(180),
  heroSubtitle: z.string().trim().min(1).max(300),
  supportEyebrow: z.string().trim().min(1).max(80),
  supportTitle: z.string().trim().min(1).max(120),
  supportText: z.string().trim().min(1).max(400),
  primaryButtonLabel: z.string().trim().min(1).max(40),
  secondaryButtonLabel: z.string().trim().min(1).max(40),
  accentColor: colorHexSchema,
  linkColor: colorHexSchema,
  backgroundStartColor: colorHexSchema,
  backgroundEndColor: colorHexSchema,
  glowColor: colorHexSchema,
});

function normalizeShop(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const seen = new Set();
  return {
    ...source,
    filters: (Array.isArray(source.filters) ? source.filters : [])
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

function normalizeLabelToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function labelMatchesCategory(label, categoryValue) {
  const labelToken = normalizeLabelToken(label);
  if (!labelToken) return false;

  const categoryToken = normalizeLabelToken(categoryValue);
  const humanizedToken = normalizeLabelToken(humanizeCategoryValue(categoryValue));
  return labelToken === categoryToken || labelToken === humanizedToken;
}

function collectActiveCategories(products = []) {
  const categoryMap = new Map();

  (products || [])
    .filter((product) => product && product.isActive !== false)
    .forEach((product) => {
      getProductCategories(product).forEach((category) => {
        const token = normalizeCategoryToken(category);
        if (!category || !token || categoryMap.has(token)) return;
        categoryMap.set(token, category);
      });
    });

  return [...categoryMap.values()].sort((a, b) => a.localeCompare(b));
}

async function getShopValidationContext() {
  const productData = await storage.product.listAdmin();
  const products = Array.isArray(productData?.products) ? productData.products : [];
  return { activeCategories: collectActiveCategories(products) };
}

function normalizeShopForSave(value, context = {}) {
  const base = normalizeShop(value);
  const filters = [];
  const seen = new Set(["all"]);
  const activeCategoryMap = new Map(
    (context.activeCategories || [])
      .map((category) => String(category || "").trim())
      .filter(Boolean)
      .map((category) => [normalizeCategoryToken(category), category])
  );

  filters.push({ label: "All Products", value: "all", showInShop: true });

  (base.filters || []).forEach((filter) => {
    const filterValue = String(filter?.value || "").trim();
    const token = normalizeCategoryToken(filterValue);
    const canonicalValue = activeCategoryMap.get(token);
    if (!filterValue || token === "all" || seen.has(token) || !canonicalValue) return;
    seen.add(token);
    filters.push({
      label: labelMatchesCategory(filter?.label, canonicalValue)
        ? String(filter?.label || "").trim()
        : humanizeCategoryValue(canonicalValue),
      value: canonicalValue,
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
  const source = Array.isArray(list) ? list : [];
  return source.map((d) => ({
    ...d,
    sourceCategories: normalizeCategoryList(d.sourceCategories, d.sourceCategory),
    sourceCategory: normalizeCategoryList(d.sourceCategories, d.sourceCategory)[0] || "",
    productIds: Array.isArray(d.productIds) ? d.productIds : [],
  }));
}

function dedupeValues(values = [], normalizer = normalizeCategoryToken) {
  const seen = new Set();
  return (values || [])
    .map((value) => String(value || "").trim())
    .filter((value) => {
      const token = normalizer(value);
      if (!value || seen.has(token)) return false;
      seen.add(token);
      return true;
    });
}

function mapDealCategoriesToCanonical(categories, context = {}) {
  const cleaned = dedupeValues(categories);
  if (!context.activeCategoryMap) return cleaned;
  return dedupeValues(
    cleaned
      .map((category) => context.activeCategoryMap.get(normalizeCategoryToken(category)) || "")
      .filter(Boolean)
  );
}

function getCanonicalDealProductIds(productIds, context = {}, maxItems = 50) {
  const ids = dedupeValues(productIds, (value) => String(value || "").trim());
  const filteredIds = context.activeProductMap
    ? ids.filter((id) => context.activeProductMap.has(String(id)))
    : ids;
  return filteredIds.slice(0, Math.max(1, Number(maxItems || 1)));
}

function getDerivedDealCategoriesFromProducts(productIds, context = {}) {
  if (!context.activeProductMap) return [];
  return mapDealCategoriesToCanonical(
    (productIds || [])
      .map((id) => context.activeProductMap.get(String(id)))
      .filter(Boolean)
      .flatMap((product) => getProductCategories(product)),
    context
  );
}

function resolveCanonicalDealSourceCategories(deal, context = {}) {
  const directSourceCategories = normalizeCategoryList(deal.sourceCategories, deal.sourceCategory, { allowEmpty: true });
  const validDirectCategories = mapDealCategoriesToCanonical(directSourceCategories, context);
  if (validDirectCategories.length) return validDirectCategories;
  return getDerivedDealCategoriesFromProducts(deal.productIds, context);
}

function resolveCanonicalDealFilterValue(requestedFilter, sourceCategories, context = {}) {
  const requestedFilterValue = String(requestedFilter || "").trim();
  const requestedFilterToken = normalizeCategoryToken(requestedFilterValue);
  if (!context.filterMap) return requestedFilterValue || sourceCategories[0] || "all";
  if (requestedFilterToken === "all") return "all";
  if (requestedFilterToken && context.filterMap.has(requestedFilterToken)) {
    return context.filterMap.get(requestedFilterToken);
  }
  const fallbackCategory = (sourceCategories || []).find((category) =>
    context.filterMap.has(normalizeCategoryToken(category))
  );
  if (fallbackCategory) {
    return context.filterMap.get(normalizeCategoryToken(fallbackCategory));
  }
  return "all";
}

function canonicalizeDeal(deal, context = {}) {
  const maxItems = Math.max(1, Number(deal.maxItems || 1));
  const productIds = getCanonicalDealProductIds(deal.productIds, context, maxItems);
  const sourceCategories = resolveCanonicalDealSourceCategories({ ...deal, productIds }, context);
  return {
    ...deal,
    maxItems,
    sourceCategories,
    sourceCategory: sourceCategories[0] || "",
    seeMoreFilter: resolveCanonicalDealFilterValue(deal.seeMoreFilter, sourceCategories, context),
    productIds,
  };
}

function normalizeDealsForResponse(list, context = {}) {
  return normalizeDeals(list).map((deal) => canonicalizeDeal(deal, context));
}

async function getDealsValidationContext() {
  const [productData, shopSettings] = await Promise.all([
    storage.product.listAdmin(),
    storage.cms.getShop(),
  ]);

  const products = Array.isArray(productData?.products) ? productData.products : [];
  const activeProducts = products.filter((product) => product && product.isActive !== false);
  const activeCategoriesList = collectActiveCategories(activeProducts);
  const activeProductIds = new Set(activeProducts.map((product) => String(product.id)));
  const activeCategoryMap = new Map(
    activeCategoriesList.map((category) => [normalizeCategoryToken(category), category])
  );
  const activeCategories = new Set(activeCategoryMap.keys());
  const normalizedShop = normalizeShopForSave(shopSettings || {}, { activeCategories: activeCategoriesList });
  const filterMap = new Map(
    (Array.isArray(normalizedShop?.filters) ? normalizedShop.filters : [])
      .map((filter) => {
        const value = String(filter?.value || "").trim();
        return value ? [normalizeCategoryToken(value), value] : null;
      })
      .filter(Boolean)
  );
  const filterValues = new Set(
    [...filterMap.keys()].filter(Boolean)
  );
  filterValues.add("all");

  return {
    activeProducts,
    activeProductIds,
    activeCategories,
    activeCategoryMap,
    activeProductMap: new Map(activeProducts.map((product) => [String(product.id), product])),
    filterMap,
    filterValues,
  };
}

function normalizeDealsForSave(list, context = {}) {
  return normalizeDeals(list).map((deal) => canonicalizeDeal(deal, context));
}

function validateDeals(list, context) {
  for (const deal of list) {
    const sourceCategories = normalizeCategoryList(deal.sourceCategories, deal.sourceCategory, { allowEmpty: true });
    if (!sourceCategories.length) {
      return `Deal "${deal.name}" needs at least one active source category or pinned product.`;
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
  return res.json({ settings: normalizeHomeSettings(await storage.cms.getHome()) });
}
async function setHome(req, res) {
  const parsed = homeSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
  const settings = await storage.cms.setHome(normalizeHomeSettings(parsed.data));
  await storage.audit.add({
    actorId: req.user?.sub || null,
    action: "change",
    entityType: "home",
    entityId: null,
    summary: `Updated homepage ads: ${(Array.isArray(settings?.ads) ? settings.ads.length : 0)} configured`,
  });
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
  const [settings, context] = await Promise.all([
    storage.cms.getDeals(),
    getDealsValidationContext(),
  ]);
  return res.json({ settings: normalizeDealsForResponse(settings, context) });
}
async function setDeals(req, res) {
  const parsed = dealsSchema.safeParse(req.body || []);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
  const context = await getDealsValidationContext();
  const nextDeals = normalizeDealsForSave(parsed.data, context);
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

async function getAbout(_req, res) {
  return res.json({ settings: normalizeAboutSettings(await storage.cms.getAbout()) });
}
async function setAbout(req, res) {
  const parsed = aboutSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
  const settings = await storage.cms.setAbout(normalizeAboutSettings(parsed.data));
  await storage.audit.add({
    actorId: req.user?.sub || null,
    action: "change",
    entityType: "about",
    entityId: null,
    summary: "Updated About page content",
  });
  return res.json({ settings });
}

async function getAdminPage(_req, res) {
  return res.json({ settings: normalizeAdminPageSettings(await storage.cms.getAdminPage()) });
}

async function setAdminPage(req, res) {
  const parsed = adminPageSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
  const settings = await storage.cms.setAdminPage(normalizeAdminPageSettings(parsed.data));
  await storage.audit.add({
    actorId: req.user?.sub || null,
    action: "change",
    entityType: "admin_page",
    entityId: null,
    summary: "Updated admin page appearance",
  });
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
  getAbout,
  setAbout,
  getAdminPage,
  setAdminPage,
  uploadHomeImage,
  uploadCmsImage,
};
