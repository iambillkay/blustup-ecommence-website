const mongoose = require("mongoose");

const User = require("../models/User");
const Product = require("../models/Product");
const AuditLog = require("../models/AuditLog");
const CmsConfig = require("../models/CmsConfig");

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeCategoryList(categories, fallbackCategory) {
  const source = Array.isArray(categories)
    ? categories
    : typeof categories === "string"
      ? categories.split(",")
      : [];
  const seen = new Set();
  const normalized = source
    .map((value) => String(value || "").trim())
    .filter((value) => {
      const token = value.toLowerCase();
      if (!value || seen.has(token)) return false;
      seen.add(token);
      return true;
    });

  if (normalized.length) return normalized;

  const fallback = String(fallbackCategory || "").trim() || "general";
  return [fallback];
}

function getProductCategories(product) {
  return normalizeCategoryList(product?.categories, product?.category);
}

function mapProductOut(p) {
  const categories = getProductCategories(p);
  return {
    id: p._id.toString(),
    name: p.name,
    price: p.price,
    desc: p.description,
    cat: categories[0],
    categories,
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
  if (category) {
    const exactCategory = { $regex: `^${escapeRegex(String(category).trim())}$`, $options: "i" };
    query.$and = [...(query.$and || []), { $or: [{ category: exactCategory }, { categories: exactCategory }] }];
  }
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
        { categories: { $regex: needle, $options: "i" } },
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
  const categories = normalizeCategoryList(payload?.categories, payload?.category);
  const created = await Product.create({
    ...payload,
    category: categories[0],
    categories,
  });
  return mapProductOut(created);
}

async function updateProduct(id, payload) {
  const nextPayload = { ...payload };
  if (payload?.categories !== undefined || payload?.category !== undefined) {
    const categories = normalizeCategoryList(payload?.categories, payload?.category);
    nextPayload.category = categories[0];
    nextPayload.categories = categories;
  }
  const updated = await Product.findByIdAndUpdate(id, nextPayload, { new: true });
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
    { label: "All Products", value: "all", showInShop: true },
    { label: "Electronics", value: "flights", showInShop: true },
    { label: "Clothes", value: "lounge", showInShop: true },
    { label: "Consumables", value: "upgrades", showInShop: true },
    { label: "Travel Essentials", value: "essentials", showInShop: true },
    { label: "Maintenance Kits", value: "insurance", showInShop: true },
  ],
};

const DEFAULT_AI = {
  chatEnabled: true,
  searchEnabled: true,
  botName: "Blustup AI",
  userPersona: "everyday online shoppers in Ghana who want reliable value and clear guidance",
  systemPrompt:
    "You are Blustup's shopping assistant. Give brief, direct answers. Recommend products when relevant.",
};

const DEFAULT_DEALS = [
  {
    id: "deal-1",
    name: "Oraimo Brand Day",
    timerSeconds: 80200,
    seeMoreFilter: "flights",
    sourceCategory: "flights",
    sourceCategories: ["flights", "essentials"],
    maxItems: 8,
    isActive: true,
    productIds: [],
  },
  {
    id: "deal-2",
    name: "Personal Care Day",
    timerSeconds: 21600,
    seeMoreFilter: "lounge",
    sourceCategory: "lounge",
    sourceCategories: ["lounge", "insurance"],
    maxItems: 8,
    isActive: true,
    productIds: [],
  },
];

const DEFAULT_FAQ = {
  pageTitle: "Frequently asked\nquestions",
  label: "Have Questions?",
  intro: "Find answers about orders, shipping, and your Blustup account.",
  helpTitle: "Still have a question?",
  helpText:
    "Can't find the answer to your question? Send us an email and we'll get back to you as soon as possible.",
  contactEmail: "support@blustup.local",
  faqs: [
    {
      question: "How do I create an account?",
      answer:
        'Click on "Create account" from the login page, enter your name, email, and password, then click "Create Account". You\'ll be logged in automatically!',
    },
    {
      question: "How do I add products to my cart?",
      answer:
        'Browse the shop, find a product you like, and click the "+ Add" button. Your cart count will update at the top right.',
    },
    {
      question: "Is my personal information secure?",
      answer:
        "Yes! We use 256-bit SSL encryption to protect all your data. Your password is hashed with bcryptjs for extra security.",
    },
    {
      question: "Can I use promo codes?",
      answer:
        'Yes! Enter a valid promo code in your cart summary and click "Apply" to get discounts on your order.',
    },
    {
      question: "What payment methods do you accept?",
      answer:
        "We accept credit/debit cards, PayPal, Apple Pay, and Google Pay at checkout. Pay on delivery is also available.",
    },
  ],
  boardTitle: "Board of directors",
  board: [
    {
      name: "Amina Osei",
      role: "Chair & CEO",
      bio: "Leads strategy and partnerships across retail and logistics for Blustup.",
      imageUrl: null,
    },
    {
      name: "Jordan Mensah",
      role: "Chief Operating Officer",
      bio: "Oversees day-to-day operations, vendor relationships, and customer experience.",
      imageUrl: null,
    },
    {
      name: "Priya Nair",
      role: "Chief Technology Officer",
      bio: "Drives platform security, payments infrastructure, and product engineering.",
      imageUrl: null,
    },
  ],
};

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
    getFaq: () => getCmsByKey("faq", DEFAULT_FAQ),
    setFaq: (value) => upsertCmsByKey("faq", value),
  },
};
