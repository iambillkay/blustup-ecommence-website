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

function toBaseFields(body) {
  return {
    name: body?.name,
    description: body?.description ?? body?.desc,
    category: body?.category ?? body?.cat,
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

const createProductSchema = z.object({
  name: z.string().trim().min(1).max(160),
  price: z.number().min(0),
  description: z.string().trim().min(0).max(5000),
  category: z.string().trim().min(1).max(80),
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
    category: parsed.data.category,
    stockQty: parsed.data.stockQty,
    oldPrice: parsed.data.oldPrice ?? null,
    imageUrl: parsed.data.imageUrl ?? null,
    badge: parsed.data.badge ?? null,
    badgeType: parsed.data.badgeType ?? null,
    icon: parsed.data.icon ?? null,
    color: parsed.data.color ?? null,
    isActive: parsed.data.isActive,
  });

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
  if (parsed.data.category !== undefined) updatePayload.category = parsed.data.category;
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

