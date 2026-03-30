const { z } = require("zod");
const storage = require("../storage");

function toNumberOrNull(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

function toBooleanLike(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  const s = String(v).trim().toLowerCase();
  if (s === "1" || s === "true" || s === "yes") return true;
  if (s === "0" || s === "false" || s === "no") return false;
  return undefined;
}

function normalizeCategoryToken(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeCategoryList(value, fallbackValue, options = {}) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? (() => {
          const trimmed = value.trim();
          if (!trimmed) return [];
          if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            try {
              const parsed = JSON.parse(trimmed);
              return Array.isArray(parsed) ? parsed : [trimmed];
            } catch (_e) {
              return trimmed.split(",");
            }
          }
          return trimmed.split(",");
        })()
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

  const fallback = String(fallbackValue || "").trim() || "general";
  return [fallback];
}

function getProductCategories(product) {
  return normalizeCategoryList(product?.categories, product?.cat || product?.category);
}

function toBaseFields(body) {
  return {
    name: body?.name,
    description: body?.description ?? body?.desc,
    category: body?.category ?? body?.cat,
    categories: body?.categories ?? body?.cats,
    price: body?.price,
    oldPrice: body?.oldPrice,
    imageUrl: body?.imageUrl,
    badge: body?.badge,
    badgeType: body?.badgeType,
    icon: body?.icon,
    color: body?.color,
    isActive: body?.isActive,
    // IMPORTANT: do not default in the shared mapper; otherwise PATCH updates will
    // overwrite existing stock with 0 when clients omit the field.
    stockQty: body?.stockQty ?? body?.stock_quantity ?? body?.stock,
  };
}

function formatCategoryLabel(value) {
  return String(value || "")
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function ensureShopFiltersForCategories(categories) {
  const values = normalizeCategoryList(categories, null, { allowEmpty: true });
  const current = await storage.cms.getShop();
  const filters = Array.isArray(current?.filters) ? [...current.filters] : [];
  const existingTokens = new Set(filters.map((filter) => normalizeCategoryToken(filter?.value)).filter(Boolean));
  const missing = values.filter((value) => {
    const token = normalizeCategoryToken(value);
    return token && token !== "all" && !existingTokens.has(token);
  });

  if (!missing.length) return false;

  await storage.cms.setShop({
    title: current?.title || "Welcome to the Shop",
    subtitle: current?.subtitle || "Discover products tailored to your needs",
    filters: [
      ...filters,
      ...missing.map((value) => ({
        label: formatCategoryLabel(value),
        value,
        showInShop: true,
      })),
    ],
  });

  return true;
}

async function pruneDealsForProduct(productId) {
  const [currentDeals, productData] = await Promise.all([
    storage.cms.getDeals(),
    storage.product.listAdmin(),
  ]);
  const deals = Array.isArray(currentDeals) ? currentDeals : [];
  const products = Array.isArray(productData?.products) ? productData.products : [];
  const activeProducts = products.filter((product) => product && product.isActive !== false);
  const activeProductIds = new Set(activeProducts.map((product) => String(product.id)));
  const activeCategories = new Set(
    activeProducts.flatMap((product) => getProductCategories(product).map(normalizeCategoryToken)).filter(Boolean)
  );
  let changed = false;

  const nextDeals = deals.map((deal) => {
    const ids = Array.isArray(deal?.productIds) ? deal.productIds.map(String) : [];
    const filteredIds = [...new Set(
      ids.filter((id) => id !== String(productId) && activeProductIds.has(String(id)))
    )].slice(0, Math.max(1, Number(deal?.maxItems || 1)));
    const fallbackCategories = normalizeCategoryList(deal?.sourceCategories, deal?.sourceCategory, { allowEmpty: true });
    const hasFallbackCategory = fallbackCategories.some((category) => activeCategories.has(normalizeCategoryToken(category)));
    const nextIsActive = deal?.isActive !== false && (filteredIds.length > 0 || hasFallbackCategory);
    const normalizedFallbackPrimary = fallbackCategories[0] || "";
    const previousFallbackCategories = Array.isArray(deal?.sourceCategories)
      ? deal.sourceCategories.map(normalizeCategoryToken)
      : [];
    const normalizedFallbackUnchanged =
      normalizeCategoryToken(deal?.sourceCategory) === normalizeCategoryToken(normalizedFallbackPrimary)
      && JSON.stringify(previousFallbackCategories) === JSON.stringify(fallbackCategories.map(normalizeCategoryToken));
    if (filteredIds.length === ids.length && nextIsActive === deal?.isActive && normalizedFallbackUnchanged) return deal;
    changed = true;
    return {
      ...deal,
      sourceCategory: normalizedFallbackPrimary,
      sourceCategories: fallbackCategories,
      productIds: filteredIds,
      isActive: nextIsActive,
    };
  });

  if (changed) {
    await storage.cms.setDeals(nextDeals);
  }

  return changed;
}

const createProductSchema = z.object({
  name: z.string().trim().min(1).max(160),
  price: z.number().min(0),
  description: z.string().trim().min(0).max(5000),
  category: z.string().trim().min(1).max(80).optional(),
  categories: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
  stockQty: z.number().min(0).default(0),

  // Optional UI extras
  oldPrice: z.number().min(0).nullable().optional(),
  // Your UI currently doesn't enforce strict URL formatting, so keep this permissive.
  imageUrl: z.string().trim().nullable().optional(),
  badge: z.string().trim().nullable().optional(),
  badgeType: z.string().trim().nullable().optional(),
  icon: z.string().trim().nullable().optional(),
  color: z.string().trim().nullable().optional(),
  isActive: z.boolean().default(true),
});

const updateProductSchema = createProductSchema.partial();

async function listPublic(req, res) {
  const page = Number(req.query.page || 1);
  const limit = Math.min(Number(req.query.limit || 12), 50);
  const q = String(req.query.q || "").trim() || undefined;
  const category = String(req.query.category || req.query.cat || "").trim() || undefined;
  const minPrice = toNumberOrNull(req.query.minPrice);
  const maxPrice = toNumberOrNull(req.query.maxPrice);

  return res.json(await storage.product.listPublic({ page, limit, q, category, minPrice, maxPrice }));
}

async function listAdmin(req, res) {
  return res.json(await storage.product.listAdmin());
}

async function createProduct(req, res) {
  const body = toBaseFields(req.body || {});
  const imageUrlFromUpload = req.file ? `/uploads/${req.file.filename}` : undefined;

  const payload = {
    name: body.name,
    price: body.price,
    description: body.description,
    category: body.category,
    categories: normalizeCategoryList(body.categories, body.category),
    stockQty: body.stockQty == null ? 0 : body.stockQty,
    oldPrice: body.oldPrice,
    imageUrl: imageUrlFromUpload ?? body.imageUrl,
    badge: body.badge,
    badgeType: body.badgeType,
    icon: body.icon,
    color: body.color,
    isActive: body.isActive,
  };

  const parsed = createProductSchema.safeParse({
    ...payload,
    category: payload.categories?.[0] || payload.category,
    categories: payload.categories,
    price: Number(payload.price),
    stockQty: Number(payload.stockQty),
    oldPrice: payload.oldPrice == null || payload.oldPrice === "" ? null : Number(payload.oldPrice),
    imageUrl: payload.imageUrl ? String(payload.imageUrl) : null,
    badge: payload.badge ? String(payload.badge) : null,
    badgeType: payload.badgeType ? String(payload.badgeType) : null,
    icon: payload.icon ? String(payload.icon) : null,
    color: payload.color ? String(payload.color) : null,
    isActive: toBooleanLike(payload.isActive) ?? true,
  });

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
  }

  const created = await storage.product.create({
    name: parsed.data.name,
    price: parsed.data.price,
    description: parsed.data.description,
    category: parsed.data.categories[0],
    categories: parsed.data.categories,
    stockQty: parsed.data.stockQty,
    oldPrice: parsed.data.oldPrice ?? null,
    imageUrl: parsed.data.imageUrl ?? null,
    badge: parsed.data.badge ?? null,
    badgeType: parsed.data.badgeType ?? null,
    icon: parsed.data.icon ?? null,
    color: parsed.data.color ?? null,
    isActive: parsed.data.isActive,
  });

  await ensureShopFiltersForCategories(created.categories);

  await storage.audit.add({
    actorId: req.user?.sub || null,
    action: "add",
    entityType: "product",
    entityId: created.id,
    summary: `Created product: ${created.name}`,
  });

  return res.status(201).json({ product: created });
}

async function updateProduct(req, res) {
  const id = req.params.id;
  if (!storage.isValidId(id)) return res.status(400).json({ error: "Invalid id" });

  const body = toBaseFields(req.body || {});
  const imageUrlFromUpload = req.file ? `/uploads/${req.file.filename}` : undefined;

  const candidate = {
    name: body.name,
    description: body.description,
    category: body.category,
    categories: body.categories === undefined && body.category === undefined
      ? undefined
      : normalizeCategoryList(body.categories, body.category),
    price: body.price == null ? undefined : Number(body.price),
    stockQty: body.stockQty == null ? undefined : Number(body.stockQty),
    oldPrice:
      body.oldPrice === undefined
        ? undefined
        : body.oldPrice === null || body.oldPrice === ""
          ? null
          : Number(body.oldPrice),
    imageUrl:
      imageUrlFromUpload !== undefined
        ? imageUrlFromUpload
        : body.imageUrl === undefined
          ? undefined
          : body.imageUrl === "" || body.imageUrl == null
            ? null
            : String(body.imageUrl),
    badge: body.badge === undefined ? undefined : body.badge === "" ? null : String(body.badge),
    badgeType:
      body.badgeType === undefined ? undefined : body.badgeType === "" ? null : String(body.badgeType),
    icon: body.icon === undefined ? undefined : body.icon === "" ? null : String(body.icon),
    color: body.color === undefined ? undefined : body.color === "" ? null : String(body.color),
    isActive: body.isActive === undefined ? undefined : toBooleanLike(body.isActive) ?? undefined,
  };

  const parsed = updateProductSchema.safeParse(candidate);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });

  const updatePayload = {};
  if (parsed.data.name !== undefined) updatePayload.name = parsed.data.name;
  if (parsed.data.price !== undefined) updatePayload.price = parsed.data.price;
  if (parsed.data.description !== undefined) updatePayload.description = parsed.data.description;
  if (parsed.data.categories !== undefined) {
    updatePayload.categories = parsed.data.categories;
    updatePayload.category = parsed.data.categories[0];
  } else if (parsed.data.category !== undefined) {
    updatePayload.categories = normalizeCategoryList(parsed.data.category, parsed.data.category);
    updatePayload.category = updatePayload.categories[0];
  }
  if (parsed.data.stockQty !== undefined) updatePayload.stockQty = parsed.data.stockQty;
  if (parsed.data.oldPrice !== undefined) updatePayload.oldPrice = parsed.data.oldPrice;
  if (parsed.data.imageUrl !== undefined) updatePayload.imageUrl = parsed.data.imageUrl;
  if (parsed.data.badge !== undefined) updatePayload.badge = parsed.data.badge;
  if (parsed.data.badgeType !== undefined) updatePayload.badgeType = parsed.data.badgeType;
  if (parsed.data.icon !== undefined) updatePayload.icon = parsed.data.icon;
  if (parsed.data.color !== undefined) updatePayload.color = parsed.data.color;
  if (parsed.data.isActive !== undefined) updatePayload.isActive = parsed.data.isActive;

  const updated = await storage.product.update(id, updatePayload);
  if (!updated) return res.status(404).json({ error: "Not found" });

  await ensureShopFiltersForCategories(updated.categories);
  await pruneDealsForProduct(updated.id);

  await storage.audit.add({
    actorId: req.user?.sub || null,
    action: "change",
    entityType: "product",
    entityId: updated.id,
    summary: `Updated product: ${updated.name}`,
  });

  return res.json({ product: updated });
}

async function deleteProduct(req, res) {
  const id = req.params.id;
  if (!storage.isValidId(id)) return res.status(400).json({ error: "Invalid id" });

  const existing = await storage.product.delete(id);
  if (!existing) return res.status(404).json({ error: "Not found" });

  await pruneDealsForProduct(id);

  await storage.audit.add({
    actorId: req.user?.sub || null,
    action: "delete",
    entityType: "product",
    entityId: id,
    summary: `Deleted product: ${existing.name}`,
  });

  return res.json({ ok: true });
}

module.exports = { listPublic, listAdmin, createProduct, updateProduct, deleteProduct };
