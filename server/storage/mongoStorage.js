const mongoose = require("mongoose");

const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Tracking = require("../models/Tracking");
const AuditLog = require("../models/AuditLog");
const CmsConfig = require("../models/CmsConfig");
const { normalizeProductReviews, buildLoyaltyProfile } = require("../utils/storefront");
const {
  DEFAULT_HOME_SETTINGS,
  DEFAULT_ABOUT_SETTINGS,
  DEFAULT_REPORT_SETTINGS,
  DEFAULT_DELIVERY_SETTINGS,
  DEFAULT_ADMIN_PAGE_SETTINGS,
  normalizeHomeSettings,
  normalizeAboutSettings,
  normalizeReportSettings,
  normalizeDeliverySettings,
  normalizeAdminPageSettings,
} = require("../utils/cmsDefaults");
const { DEFAULT_DEALS_SETTINGS } = require("../utils/defaultCatalog");

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

function normalizeBillingProfile(profile = {}) {
  const source = profile && typeof profile === "object" ? profile : {};
  return {
    firstName: source.firstName ? String(source.firstName).trim() : null,
    lastName: source.lastName ? String(source.lastName).trim() : null,
    street: source.street ? String(source.street).trim() : null,
    city: source.city ? String(source.city).trim() : null,
    state: source.state ? String(source.state).trim() : null,
    zip: source.zip ? String(source.zip).trim() : null,
    country: source.country ? String(source.country).trim() : null,
  };
}

function mapProductOut(p) {
  const categories = getProductCategories(p);
  const reviewSummary = normalizeProductReviews(p);
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
    ratingAverage: reviewSummary.averageRating,
    reviewCount: reviewSummary.reviewCount,
    reviews: reviewSummary.reviews,
    isActive: Boolean(p.isActive),
    stockQty: p.stockQty ?? 0,
  };
}

function mapUserOut(user) {
  const loyalty = buildLoyaltyProfile(user.loyaltyPoints);
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone || null,
    loyaltyPoints: loyalty.points,
    loyalty,
    billingProfile: normalizeBillingProfile(user.billingProfile),
    role: user.role,
    createdAt: user.createdAt?.toISOString?.() || null,
    updatedAt: user.updatedAt?.toISOString?.() || null,
  };
}

function mapOrderOut(order) {
  const deliveryAssignment = order.deliveryAssignment && typeof order.deliveryAssignment === "object"
    ? {
        id: order.deliveryAssignment.id || null,
        riderId: order.deliveryAssignment.riderId ? String(order.deliveryAssignment.riderId) : null,
        riderName: order.deliveryAssignment.riderName || null,
        riderEmail: order.deliveryAssignment.riderEmail || null,
        riderPhone: order.deliveryAssignment.riderPhone || null,
        coverage: order.deliveryAssignment.coverage || null,
        status: order.deliveryAssignment.status || null,
        note: order.deliveryAssignment.note || "",
        source: order.deliveryAssignment.source || null,
        assignedAt: order.deliveryAssignment.assignedAt?.toISOString?.() || null,
        notifiedAt: order.deliveryAssignment.notifiedAt?.toISOString?.() || null,
      }
    : null;

  return {
    id: order._id.toString(),
    reference: order.reference,
    userId: order.userId ? order.userId.toString() : null,
    sessionId: order.sessionId || null,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone || null,
    billingAddress: normalizeBillingProfile(order.billingAddress),
    items: Array.isArray(order.items)
      ? order.items.map((item) => ({
          productId: String(item.productId),
          name: item.name,
          price: Number(item.price || 0),
          qty: Number(item.qty || 0),
          imageUrl: item.imageUrl || null,
        }))
      : [],
    paymentMethod: order.paymentMethod,
    promoCode: order.promoCode ?? null,
    promoLabel: order.promoLabel ?? null,
    subtotal: Number(order.subtotal || 0),
    discount: Number(order.discount || 0),
    shipping: Number(order.shipping || 0),
    tax: Number(order.tax || 0),
    total: Number(order.total || 0),
    loyaltyEarned: Number(order.loyaltyEarned || 0),
    loyaltyBalanceAfter: Number(order.loyaltyBalanceAfter || 0),
    loyaltyTierAfter: order.loyaltyTierAfter || null,
    status: order.status,
    deliveryAssignment,
    statusHistory: Array.isArray(order.statusHistory)
      ? order.statusHistory.map((entry) => ({
          status: entry.status,
          note: entry.note || "",
          actorId: entry.actorId ? entry.actorId.toString() : null,
          actorEmail: entry.actorEmail || null,
          createdAt: entry.createdAt?.toISOString?.() || null,
        }))
      : [],
    createdAt: order.createdAt?.toISOString?.() || null,
    updatedAt: order.updatedAt?.toISOString?.() || null,
  };
}

function mapTrackingOut(event) {
  return {
    id: event._id.toString(),
    userId: event.userId ? event.userId.toString() : null,
    sessionId: event.sessionId || null,
    eventType: event.eventType,
    eventData: event.eventData && typeof event.eventData === "object" ? event.eventData : {},
    createdAt: event.createdAt?.toISOString?.() || null,
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

async function addProductReview(id, payload = {}) {
  const product = await Product.findById(id);
  if (!product) return null;

  product.reviews.unshift({
    author: String(payload.author || "").trim(),
    rating: Number(payload.rating || 0),
    title: String(payload.title || "").trim(),
    comment: String(payload.comment || "").trim(),
    verifiedPurchase: payload.verifiedPurchase === true,
    createdAt: payload.createdAt || new Date(),
  });

  const reviewSummary = normalizeProductReviews(product.toObject());
  product.ratingAverage = reviewSummary.averageRating;
  product.reviewCount = reviewSummary.reviewCount;
  await product.save();

  return mapProductOut(product);
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

async function createOrder(payload) {
  const created = await Order.create({
    ...payload,
    statusHistory: [
      {
        status: payload.status || "placed",
        note: payload.initialNote || "Order placed",
        actorId: payload.userId || null,
        actorEmail: payload.customerEmail || null,
        createdAt: new Date(),
      },
    ],
  });
  return mapOrderOut(created);
}

async function listOrdersForUser({ userId, email }) {
  const orConditions = [];
  if (userId && isValidId(userId)) orConditions.push({ userId });
  if (email) orConditions.push({ customerEmail: String(email).trim().toLowerCase() });
  if (!orConditions.length) return { orders: [] };

  const orders = await Order.find({ $or: orConditions }).sort({ createdAt: -1 });
  return { orders: orders.map(mapOrderOut) };
}

async function lookupOrderByReference({ reference, email }) {
  const order = await Order.findOne({
    reference: String(reference || "").trim(),
    customerEmail: String(email || "").trim().toLowerCase(),
  });
  return order ? mapOrderOut(order) : null;
}

async function getOrderById(id) {
  const order = await Order.findById(id);
  return order ? mapOrderOut(order) : null;
}

async function listOrdersAdmin({ status, q, limit }) {
  const pageSize = Math.min(Math.max(1, Number(limit || 50)), 5000);
  const query = {};

  if (status) query.status = String(status).trim().toLowerCase();
  if (q) {
    const needle = String(q).trim();
    if (needle) {
      query.$or = [
        { reference: { $regex: needle, $options: "i" } },
        { customerName: { $regex: needle, $options: "i" } },
        { customerEmail: { $regex: needle, $options: "i" } },
      ];
    }
  }

  const orders = await Order.find(query).sort({ createdAt: -1 }).limit(pageSize);
  return { orders: orders.map(mapOrderOut) };
}

async function updateOrderStatus(id, { status, note, actorId, actorEmail }) {
  const order = await Order.findById(id);
  if (!order) return null;

  order.status = String(status || order.status).trim() || order.status;
  order.statusHistory.push({
    status: order.status,
    note: note || "",
    actorId: actorId && isValidId(actorId) ? actorId : null,
    actorEmail: actorEmail || null,
    createdAt: new Date(),
  });
  await order.save();
  return mapOrderOut(order);
}

async function updateOrderDeliveryAssignment(id, deliveryAssignment) {
  const order = await Order.findById(id);
  if (!order) return null;

  order.deliveryAssignment = deliveryAssignment && typeof deliveryAssignment === "object"
    ? {
        id: deliveryAssignment.id || null,
        riderId: deliveryAssignment.riderId || null,
        riderName: deliveryAssignment.riderName || null,
        riderEmail: deliveryAssignment.riderEmail || null,
        riderPhone: deliveryAssignment.riderPhone || null,
        coverage: deliveryAssignment.coverage || null,
        status: deliveryAssignment.status || "pending",
        note: deliveryAssignment.note || "",
        source: deliveryAssignment.source || null,
        assignedAt: deliveryAssignment.assignedAt ? new Date(deliveryAssignment.assignedAt) : null,
        notifiedAt: deliveryAssignment.notifiedAt ? new Date(deliveryAssignment.notifiedAt) : null,
      }
    : null;
  await order.save();
  return mapOrderOut(order);
}

const DEFAULT_HOME = normalizeHomeSettings(DEFAULT_HOME_SETTINGS);

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

const DEFAULT_ABOUT = normalizeAboutSettings(DEFAULT_ABOUT_SETTINGS);
const DEFAULT_REPORTS = normalizeReportSettings(DEFAULT_REPORT_SETTINGS);
const DEFAULT_DELIVERY = normalizeDeliverySettings(DEFAULT_DELIVERY_SETTINGS);
const DEFAULT_ADMIN_PAGE = normalizeAdminPageSettings(DEFAULT_ADMIN_PAGE_SETTINGS);

const DEFAULT_DEALS = DEFAULT_DEALS_SETTINGS.map((deal) => ({
  ...deal,
  sourceCategories: [...deal.sourceCategories],
  productIds: [...deal.productIds],
}));

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
  const rawValue = doc?.value;
  const value =
    rawValue
    && typeof rawValue === "object"
    && !Array.isArray(rawValue)
    && Object.prototype.hasOwnProperty.call(rawValue, "settings")
      ? rawValue.settings
      : rawValue;

  if (Array.isArray(fallback)) {
    return Array.isArray(value) ? value : fallback;
  }

  if (fallback && typeof fallback === "object") {
    return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
  }

  return value == null ? fallback : value;
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
  getAuthUserResponse: (user) => {
    const loyalty = buildLoyaltyProfile(user.loyaltyPoints);
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone || null,
      loyaltyPoints: loyalty.points,
      loyalty,
      billingProfile: normalizeBillingProfile(user.billingProfile),
      role: user.role,
    };
  },
  user: {
    findByEmail: (email) => User.findOne({ email }).select("_id name email role passwordHash phone loyaltyPoints billingProfile wishlist"),
    findById: (id) => User.findById(id).select("_id name email role passwordHash phone loyaltyPoints billingProfile wishlist"),
    create: (payload) => User.create(payload),
    updateProfile: async (id, payload = {}) => {
      const update = {};
      if (payload.name !== undefined) update.name = payload.name;
      if (payload.phone !== undefined) update.phone = payload.phone || null;
      if (payload.loyaltyPoints !== undefined) update.loyaltyPoints = Math.max(0, Math.floor(Number(payload.loyaltyPoints || 0)));
      if (payload.billingProfile !== undefined) update.billingProfile = normalizeBillingProfile(payload.billingProfile);
      return User.findByIdAndUpdate(id, update, { new: true }).select("_id name email role passwordHash phone loyaltyPoints billingProfile wishlist");
    },
    getCart: async (id) => {
      const user = await User.findById(id).select("cart");
      return user?.cart || [];
    },
    updateCart: async (id, cartItems) => {
      const updated = await User.findByIdAndUpdate(id, { $set: { cart: cartItems } }, { new: true });
      return updated?.cart || [];
    },
    getWishlist: async (id) => {
      const user = await User.findById(id).select("wishlist").populate({
        path: "wishlist",
        match: { isActive: true },
      });
      if (!user) return [];
      return (user.wishlist || []).filter(Boolean).map(mapProductOut);
    },
    addToWishlist: async (id, productId) => {
      const user = await User.findById(id).select("wishlist");
      if (!user) throw new Error("User not found");
      const ids = (user.wishlist || []).map((wId) => wId.toString());
      if (ids.includes(productId)) return (await User.findById(id).select("wishlist").populate({ path: "wishlist", match: { isActive: true } })).wishlist.filter(Boolean).map(mapProductOut);
      await User.findByIdAndUpdate(id, { $addToSet: { wishlist: productId } });
      const updated = await User.findById(id).select("wishlist").populate({ path: "wishlist", match: { isActive: true } });
      return (updated.wishlist || []).filter(Boolean).map(mapProductOut);
    },
    removeFromWishlist: async (id, productId) => {
      await User.findByIdAndUpdate(id, { $pull: { wishlist: productId } });
      const updated = await User.findById(id).select("wishlist").populate({ path: "wishlist", match: { isActive: true } });
      return (updated.wishlist || []).filter(Boolean).map(mapProductOut);
    },
    listAdmin: async () => {
      const users = await User.find({}).sort({ createdAt: -1 }).select("_id name email role phone loyaltyPoints billingProfile createdAt updatedAt");
      return { users: users.map(mapUserOut) };
    },
  },
  product: { listPublic, listAdmin, create: createProduct, update: updateProduct, addReview: addProductReview, delete: deleteProduct },
  order: {
    create: createOrder,
    getById: getOrderById,
    listForUser: listOrdersForUser,
    lookupByReference: lookupOrderByReference,
    listAdmin: listOrdersAdmin,
    updateStatus: updateOrderStatus,
    updateDeliveryAssignment: updateOrderDeliveryAssignment,
  },
  tracking: {
    add: (payload) => Tracking.create(payload),
    list: async ({ limit, since, eventType } = {}) => {
      const query = {};
      if (since) {
        const sinceDate = new Date(since);
        if (!Number.isNaN(sinceDate.getTime())) query.createdAt = { $gte: sinceDate };
      }
      if (eventType) query.eventType = String(eventType).trim();

      const pageSize = Math.min(Math.max(1, Number(limit || 1000)), 10000);
      const events = await Tracking.find(query).sort({ createdAt: -1 }).limit(pageSize);
      return { events: events.map(mapTrackingOut) };
    },
  },
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
    getAbout: async () => normalizeAboutSettings(await getCmsByKey("about", DEFAULT_ABOUT)),
    setAbout: (value) => upsertCmsByKey("about", value),
    getReports: async () => normalizeReportSettings(await getCmsByKey("reports", DEFAULT_REPORTS)),
    setReports: (value) => upsertCmsByKey("reports", value),
    getDelivery: async () => normalizeDeliverySettings(await getCmsByKey("delivery", DEFAULT_DELIVERY)),
    setDelivery: (value) => upsertCmsByKey("delivery", value),
    getAdminPage: async () => normalizeAdminPageSettings(await getCmsByKey("adminPage", DEFAULT_ADMIN_PAGE)),
    setAdminPage: (value) => upsertCmsByKey("adminPage", value),
  },
};
