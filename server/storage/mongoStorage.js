const mongoose = require("mongoose");

const User = require("../models/User");
const Product = require("../models/Product");
const AuditLog = require("../models/AuditLog");
const CmsConfig = require("../models/CmsConfig");

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function mapProductOut(p) {
  return {
    id: p._id.toString(),
    name: p.name,
    price: p.price,
    desc: p.description,
    cat: p.category,
    oldPrice: p.oldPrice ?? null,
    imageUrl: p.imageUrl ?? null,
    badge: p.badge ?? null,
    badgeType: p.badgeType ?? null,
    icon: p.icon ?? null,
    color: p.color ?? null,
    isActive: Boolean(p.isActive),
    stockQty: p.stockQty ?? 0,
  };
}

async function listPublic({ page, limit, q, category, minPrice, maxPrice }) {
  const p = Number(page || 1);
  const l = Math.min(Number(limit || 12), 50);

  const query = { isActive: true };
  if (category) query.category = category;
  if (minPrice != null || maxPrice != null) {
    query.price = {};
    if (minPrice != null) query.price.$gte = minPrice;
    if (maxPrice != null) query.price.$lte = maxPrice;
  }
  if (q) {
    const needle = String(q).trim();
    if (needle) {
      query.$or = [
        { name: { $regex: needle, $options: "i" } },
        { description: { $regex: needle, $options: "i" } },
        { category: { $regex: needle, $options: "i" } },
      ];
    }
  }

  const [totalItems, products] = await Promise.all([
    Product.countDocuments(query),
    Product.find(query).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalItems / l));

  return {
    products: products.map(mapProductOut),
    pagination: { page: p, limit: l, totalPages, totalItems },
  };
}

async function listAdmin() {
  const products = await Product.find({}).sort({ createdAt: -1 });
  return { products: products.map(mapProductOut) };
}

async function createProduct(payload) {
  const created = await Product.create(payload);
  return mapProductOut(created);
}

async function updateProduct(id, payload) {
  const updated = await Product.findByIdAndUpdate(id, payload, { new: true });
  if (!updated) return null;
  return mapProductOut(updated);
}

async function deleteProduct(id) {
  const existing = await Product.findById(id);
  if (!existing) return null;
  await Product.deleteOne({ _id: id });
  return mapProductOut(existing);
}

async function addAuditLog({ actorId, action, entityType, entityId, summary }) {
  await AuditLog.create({
    actor: actorId || null,
    action,
    entityType,
    entityId: entityId || null,
    summary: summary || "",
  });
}

async function listRecentAudit({ limit }) {
  const l = Math.min(Number(limit || 20), 100);
  const rows = await AuditLog.find({})
    .sort({ createdAt: -1 })
    .limit(l)
    .populate({ path: "actor", select: "email" });

  return {
    actions: rows.map((a) => ({
      action: a.action,
      entity_type: a.entityType,
      entity_id: a.entityId,
      summary: a.summary,
      actor_email: a.actor?.email || null,
      created_at: a.createdAt.toISOString(),
    })),
  };
}

const DEFAULT_HOME = {
  adImages: [
    "product-imgs/ad/ad1.png",
    "product-imgs/ad/ad2.png",
    "product-imgs/ad/ad3.png",
  ],
};

const DEFAULT_SHOP = {
  title: "Welcome to the Shop",
  subtitle: "Discover products tailored to your needs",
  filters: [
    { label: "All Products", value: "all" },
    { label: "Electronics", value: "flights" },
    { label: "Clothes", value: "lounge" },
    { label: "Consumables", value: "upgrades" },
    { label: "Travel Essentials", value: "essentials" },
    { label: "Maintenance Kits", value: "insurance" },
  ],
};

const DEFAULT_AI = {
  chatEnabled: true,
  searchEnabled: true,
  botName: "Blustup AI",
  systemPrompt:
    "You are a helpful shopping assistant for Blustup. Answer concisely and recommend relevant products.",
};

const DEFAULT_DEALS = [
  {
    id: "deal-1",
    name: "Oraimo Brand Day",
    timerSeconds: 80200,
    seeMoreFilter: "flights",
    sourceCategory: "flights",
    maxItems: 8,
    isActive: true,
  },
  {
    id: "deal-2",
    name: "Personal Care Day",
    timerSeconds: 21600,
    seeMoreFilter: "lounge",
    sourceCategory: "lounge",
    maxItems: 8,
    isActive: true,
  },
];

async function getCmsByKey(key, fallback) {
  const doc = await CmsConfig.findOne({ key }).select("value");
  return doc?.value || fallback;
}

async function upsertCmsByKey(key, value) {
  await CmsConfig.findOneAndUpdate(
    { key },
    { $set: { value } },
    { upsert: true, new: true }
  );
  return value;
}

module.exports = {
  mode: "mongo",
  isValidId,
  user: {
    findByEmail: (email) => User.findOne({ email }).select("_id name email role passwordHash"),
    findById: (id) => User.findById(id).select("_id name email role passwordHash"),
    create: (payload) => User.create(payload),
  },
  product: { listPublic, listAdmin, create: createProduct, update: updateProduct, delete: deleteProduct },
  audit: { add: addAuditLog, listRecent: listRecentAudit },
  cms: {
    getHome: () => getCmsByKey("home", DEFAULT_HOME),
    setHome: (value) => upsertCmsByKey("home", value),
    getShop: () => getCmsByKey("shop", DEFAULT_SHOP),
    setShop: (value) => upsertCmsByKey("shop", value),
    getAi: () => getCmsByKey("ai", DEFAULT_AI),
    setAi: (value) => upsertCmsByKey("ai", value),
    getDeals: () => getCmsByKey("deals", DEFAULT_DEALS),
    setDeals: (value) => upsertCmsByKey("deals", value),
  },
};

