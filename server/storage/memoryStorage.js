const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");

const {
  normalizeProductReviews,
  normalizeStoredReview,
  buildLoyaltyProfile,
} = require("../utils/storefront");
const {
  DEFAULT_HOME_SETTINGS,
  DEFAULT_ABOUT_SETTINGS,
  DEFAULT_REPORT_SETTINGS,
  normalizeHomeSettings,
  normalizeAboutSettings,
  normalizeReportSettings,
} = require("../utils/cmsDefaults");

const STATE_FILE = path.join(__dirname, "memory-state.json");
const DEFAULT_AI = {
  chatEnabled: true,
  searchEnabled: true,
  botName: "Blustup AI",
  userPersona: "everyday online shoppers in Ghana who want reliable value and clear guidance",
  systemPrompt:
    "You are Blustup's shopping assistant. Give brief, direct answers. Recommend products when relevant.",
};

function makeId() {
  return crypto.randomUUID();
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeCategoryList(categories, fallbackCategory) {
  const source = Array.isArray(categories)
    ? categories
    : typeof categories === "string"
      ? categories.split(",")
      : [];
  const seen = new Set();
  const values = source
    .map((value) => String(value || "").trim())
    .filter((value) => {
      const token = value.toLowerCase();
      if (!value || seen.has(token)) return false;
      seen.add(token);
      return true;
    });

  if (values.length) return values;

  const fallback = String(fallbackCategory || "").trim() || "general";
  return [fallback];
}

function normalizeCategoryToken(value) {
  return String(value || "").trim().toLowerCase();
}

function toDate(value) {
  if (value instanceof Date) return value;
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function toISO(value) {
  return toDate(value).toISOString();
}

function createDefaultCmsState() {
  return {
    home: normalizeHomeSettings(DEFAULT_HOME_SETTINGS),
    shop: {
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
    },
    deals: [
      {
        id: "deal-1",
        name: "Oraimo Brand Day",
        timerSeconds: 80200,
        seeMoreFilter: "oriamo",
        sourceCategory: "oriamo",
        sourceCategories: ["oriamo"],
        maxItems: 8,
        isActive: true,
        productIds: [],
      },
      {
        id: "deal-2",
        name: "Personal Care Day",
        timerSeconds: 21600,
        seeMoreFilter: "personal care",
        sourceCategory: "personal care",
        sourceCategories: ["personal care"],
        maxItems: 8,
        isActive: true,
        productIds: [],
      },
    ],
    faq: {
      pageTitle: "Frequently asked\nquestions",
      label: "● Have Questions?",
      intro: "",
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
    },
    about: normalizeAboutSettings(DEFAULT_ABOUT_SETTINGS),
    reports: normalizeReportSettings(DEFAULT_REPORT_SETTINGS),
    ai: { ...DEFAULT_AI },
  };
}

function createDefaultState() {
  return {
    users: [],
    products: [],
    orders: [],
    tracking: [],
    audit: [],
    cms: createDefaultCmsState(),
  };
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

function normalizeProductRecord(product = {}) {
  const categories = normalizeCategoryList(product.categories, product.category);
  const createdAt = toDate(product.createdAt);
  const updatedAt = toDate(product.updatedAt || product.createdAt);
  const ratingAverageRaw =
    product.ratingAverage == null || product.ratingAverage === "" ? null : Math.max(1, Math.min(5, Number(product.ratingAverage)));
  const reviewCountRaw =
    product.reviewCount == null || product.reviewCount === "" ? 0 : Math.max(0, Math.floor(Number(product.reviewCount)));
  const reviews = Array.isArray(product.reviews) ? product.reviews.map(normalizeStoredReview).filter((review) => review.author && review.comment) : [];

  return {
    _id: String(product._id || makeId()),
    name: String(product.name || "").trim(),
    price: Number(product.price || 0),
    description: String(product.description || "").trim(),
    category: categories[0],
    categories,
    stockQty: Math.max(0, Number(product.stockQty || 0)),
    imageUrl: product.imageUrl ? String(product.imageUrl) : null,
    oldPrice:
      product.oldPrice == null || product.oldPrice === ""
        ? null
        : Math.max(0, Number(product.oldPrice || 0)),
    badge: product.badge ? String(product.badge) : null,
    badgeType: product.badgeType ? String(product.badgeType) : null,
    icon: product.icon ? String(product.icon) : null,
    color: product.color ? String(product.color) : null,
    ratingAverage: Number.isFinite(ratingAverageRaw) ? ratingAverageRaw : null,
    reviewCount: Number.isFinite(reviewCountRaw) ? reviewCountRaw : 0,
    reviews,
    isActive: product.isActive !== false,
    createdAt,
    updatedAt,
  };
}

function normalizeUserRecord(user = {}) {
  const createdAt = toDate(user.createdAt);
  const updatedAt = toDate(user.updatedAt || user.createdAt);
  return {
    _id: String(user._id || makeId()),
    name: String(user.name || "").trim(),
    email: normalizeEmail(user.email),
    passwordHash: String(user.passwordHash || ""),
    role: String(user.role || "user").trim() || "user",
    phone: user.phone ? String(user.phone) : null,
    loyaltyPoints: Math.max(0, Math.floor(Number(user.loyaltyPoints || 0))),
    billingProfile: normalizeBillingProfile(user.billingProfile),
    createdAt,
    updatedAt,
  };
}

function normalizeOrderItem(item = {}) {
  return {
    productId: String(item.productId || item.id || "").trim(),
    name: String(item.name || "").trim(),
    price: Math.max(0, Number(item.price || 0)),
    qty: Math.max(1, Number(item.qty || 1)),
    imageUrl: item.imageUrl ? String(item.imageUrl) : null,
  };
}

function normalizeStatusHistoryEntry(entry = {}) {
  return {
    status: String(entry.status || "placed").trim() || "placed",
    note: String(entry.note || "").trim(),
    actorId: entry.actorId ? String(entry.actorId) : null,
    actorEmail: entry.actorEmail ? String(entry.actorEmail) : null,
    createdAt: toDate(entry.createdAt),
  };
}

function normalizeOrderRecord(order = {}) {
  const createdAt = toDate(order.createdAt);
  const updatedAt = toDate(order.updatedAt || order.createdAt);
  return {
    _id: String(order._id || makeId()),
    reference: String(order.reference || "").trim(),
    userId: order.userId ? String(order.userId) : null,
    sessionId: order.sessionId ? String(order.sessionId) : null,
    customerName: String(order.customerName || "").trim(),
    customerEmail: normalizeEmail(order.customerEmail),
    customerPhone: order.customerPhone ? String(order.customerPhone).trim() : null,
    billingAddress: normalizeBillingProfile(order.billingAddress),
    items: Array.isArray(order.items) ? order.items.map(normalizeOrderItem).filter((item) => item.productId) : [],
    paymentMethod: String(order.paymentMethod || "card").trim(),
    promoCode: order.promoCode ? String(order.promoCode).trim() : null,
    promoLabel: order.promoLabel ? String(order.promoLabel).trim() : null,
    subtotal: Math.max(0, Number(order.subtotal || 0)),
    discount: Math.max(0, Number(order.discount || 0)),
    shipping: Math.max(0, Number(order.shipping || 0)),
    tax: Math.max(0, Number(order.tax || 0)),
    total: Math.max(0, Number(order.total || 0)),
    loyaltyEarned: Math.max(0, Number(order.loyaltyEarned || 0)),
    loyaltyBalanceAfter: Math.max(0, Number(order.loyaltyBalanceAfter || 0)),
    loyaltyTierAfter: order.loyaltyTierAfter ? String(order.loyaltyTierAfter).trim() : null,
    status: String(order.status || "placed").trim() || "placed",
    statusHistory: Array.isArray(order.statusHistory)
      ? order.statusHistory.map(normalizeStatusHistoryEntry)
      : [],
    createdAt,
    updatedAt,
  };
}

function normalizeTrackingRecord(entry = {}) {
  return {
    _id: String(entry._id || makeId()),
    userId: entry.userId ? String(entry.userId) : null,
    sessionId: entry.sessionId ? String(entry.sessionId) : null,
    eventType: String(entry.eventType || "").trim(),
    eventData: entry.eventData && typeof entry.eventData === "object" ? entry.eventData : {},
    ipAddress: entry.ipAddress ? String(entry.ipAddress) : null,
    userAgent: entry.userAgent ? String(entry.userAgent) : null,
    createdAt: toDate(entry.createdAt),
  };
}

function normalizeAuditRecord(record = {}) {
  return {
    _id: String(record._id || makeId()),
    actorId: record.actorId ? String(record.actorId) : null,
    action: String(record.action || "").trim(),
    entityType: String(record.entityType || "").trim(),
    entityId: record.entityId ? String(record.entityId) : null,
    summary: String(record.summary || ""),
    actorEmail: record.actorEmail ? String(record.actorEmail) : null,
    createdAt: toDate(record.createdAt),
  };
}

function normalizeCmsState(cms = {}) {
  const defaults = createDefaultCmsState();
  return {
    home: normalizeHomeSettings(cms?.home || defaults.home),
    shop: {
      title: String(cms?.shop?.title || defaults.shop.title),
      subtitle: String(cms?.shop?.subtitle || defaults.shop.subtitle),
      filters: Array.isArray(cms?.shop?.filters) && cms.shop.filters.length
        ? cms.shop.filters.map((filter) => ({
            label: String(filter?.label || filter?.value || "").trim(),
            value: String(filter?.value || "").trim(),
            showInShop: filter?.showInShop !== false,
          })).filter((filter) => filter.label && filter.value)
        : defaults.shop.filters,
    },
    deals: Array.isArray(cms?.deals)
      ? cms.deals.map((deal) => ({
          id: String(deal?.id || makeId()),
          name: String(deal?.name || "").trim(),
          timerSeconds: Math.max(1, Number(deal?.timerSeconds || 1)),
          seeMoreFilter: String(deal?.seeMoreFilter || "").trim(),
          sourceCategory: normalizeCategoryList(deal?.sourceCategories, deal?.sourceCategory)[0] || "",
          sourceCategories: normalizeCategoryList(deal?.sourceCategories, deal?.sourceCategory),
          maxItems: Math.max(1, Number(deal?.maxItems || 1)),
          isActive: deal?.isActive !== false,
          productIds: Array.isArray(deal?.productIds) ? deal.productIds.map((id) => String(id)) : [],
        }))
      : defaults.deals,
    faq: cms?.faq && typeof cms.faq === "object"
      ? {
          pageTitle: String(cms.faq.pageTitle || defaults.faq.pageTitle),
          label: String(cms.faq.label || defaults.faq.label),
          intro: String(cms.faq.intro || defaults.faq.intro),
          helpTitle: String(cms.faq.helpTitle || defaults.faq.helpTitle),
          helpText: String(cms.faq.helpText || defaults.faq.helpText),
          contactEmail: String(cms.faq.contactEmail || defaults.faq.contactEmail),
          faqs: Array.isArray(cms.faq.faqs) ? cms.faq.faqs : defaults.faq.faqs,
          boardTitle: String(cms.faq.boardTitle || defaults.faq.boardTitle),
          board: Array.isArray(cms.faq.board) ? cms.faq.board : defaults.faq.board,
        }
      : defaults.faq,
    about: normalizeAboutSettings(cms?.about || defaults.about),
    reports: normalizeReportSettings(cms?.reports || defaults.reports),
    ai: {
      ...DEFAULT_AI,
      ...(cms?.ai && typeof cms.ai === "object" ? cms.ai : {}),
    },
  };
}

function hydrateState(rawState = {}) {
  const defaults = createDefaultState();
  return {
    users: Array.isArray(rawState.users) ? rawState.users.map(normalizeUserRecord) : defaults.users,
    products: Array.isArray(rawState.products) ? rawState.products.map(normalizeProductRecord) : defaults.products,
    orders: Array.isArray(rawState.orders) ? rawState.orders.map(normalizeOrderRecord) : defaults.orders,
    tracking: Array.isArray(rawState.tracking) ? rawState.tracking.map(normalizeTrackingRecord) : defaults.tracking,
    audit: Array.isArray(rawState.audit) ? rawState.audit.map(normalizeAuditRecord) : defaults.audit,
    cms: normalizeCmsState(rawState.cms),
  };
}

function serializeState(currentState) {
  return {
    users: currentState.users.map((user) => ({
      ...user,
      createdAt: toISO(user.createdAt),
      updatedAt: toISO(user.updatedAt),
    })),
    products: currentState.products.map((product) => ({
      ...product,
      reviews: Array.isArray(product.reviews)
        ? product.reviews.map((review) => ({
            ...review,
            createdAt: review.createdAt ? toISO(review.createdAt) : null,
          }))
        : [],
      createdAt: toISO(product.createdAt),
      updatedAt: toISO(product.updatedAt),
    })),
    orders: currentState.orders.map((order) => ({
      ...order,
      statusHistory: order.statusHistory.map((entry) => ({
        ...entry,
        createdAt: toISO(entry.createdAt),
      })),
      createdAt: toISO(order.createdAt),
      updatedAt: toISO(order.updatedAt),
    })),
    tracking: currentState.tracking.map((entry) => ({
      ...entry,
      createdAt: toISO(entry.createdAt),
    })),
    audit: currentState.audit.map((record) => ({
      ...record,
      createdAt: toISO(record.createdAt),
    })),
    cms: currentState.cms,
  };
}

let state = createDefaultState();
try {
  if (fs.existsSync(STATE_FILE)) {
    state = hydrateState(JSON.parse(fs.readFileSync(STATE_FILE, "utf8")));
  }
} catch (error) {
  console.warn("Failed to load memory storage state:", error?.message || error);
  state = createDefaultState();
}

let persistQueue = Promise.resolve();
function persistState() {
  const payload = JSON.stringify(serializeState(state), null, 2);
  persistQueue = persistQueue
    .then(async () => {
      await fs.promises.mkdir(path.dirname(STATE_FILE), { recursive: true });
      await fs.promises.writeFile(STATE_FILE, payload, "utf8");
    })
    .catch((error) => {
      console.error("Failed to persist memory storage state:", error?.message || error);
    });
  return persistQueue;
}

function getAuthUserResponse(user) {
  const loyalty = buildLoyaltyProfile(user.loyaltyPoints);
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone || null,
    loyaltyPoints: loyalty.points,
    loyalty,
    billingProfile: normalizeBillingProfile(user.billingProfile),
    role: user.role,
  };
}

function mapOrderOut(order) {
  return {
    id: String(order._id),
    reference: order.reference,
    userId: order.userId,
    sessionId: order.sessionId,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone || null,
    billingAddress: normalizeBillingProfile(order.billingAddress),
    items: order.items.map((item) => ({ ...item })),
    paymentMethod: order.paymentMethod,
    promoCode: order.promoCode ?? null,
    promoLabel: order.promoLabel ?? null,
    subtotal: order.subtotal,
    discount: order.discount,
    shipping: order.shipping,
    tax: order.tax,
    total: order.total,
    loyaltyEarned: order.loyaltyEarned,
    loyaltyBalanceAfter: order.loyaltyBalanceAfter,
    loyaltyTierAfter: order.loyaltyTierAfter ?? null,
    status: order.status,
    statusHistory: order.statusHistory.map((entry) => ({
      ...entry,
      createdAt: toISO(entry.createdAt),
    })),
    createdAt: toISO(order.createdAt),
    updatedAt: toISO(order.updatedAt),
  };
}

function mapTrackingOut(entry) {
  return {
    id: String(entry._id),
    userId: entry.userId || null,
    sessionId: entry.sessionId || null,
    eventType: entry.eventType,
    eventData: entry.eventData && typeof entry.eventData === "object" ? { ...entry.eventData } : {},
    createdAt: toISO(entry.createdAt),
  };
}

async function seedDefaultProductsIfEmpty() {
  if (state.products.length > 0) return;

  const now = new Date();
  const seed = [
    {
      name: "Oraimo Maxi Watch",
      description: "Smart wearable with advanced battery life.",
      categories: ["flights", "essentials"],
      price: 2631.9,
      oldPrice: 4900,
      badge: "-47%",
      color: "linear-gradient(135deg,#e8f0ff,#d0dcff)",
      stockQty: 25,
      isActive: true,
      imageUrl: "product-imgs/1.jpg",
    },
    {
      name: "Oraimo Power Bank Lite",
      description: "Portable, durable power backup for daily use.",
      categories: ["flights", "essentials"],
      price: 136.9,
      oldPrice: 300,
      badge: "-56%",
      badgeType: "sale",
      color: "linear-gradient(135deg,#e8f0ff,#d0dcff)",
      stockQty: 10,
      isActive: true,
      imageUrl: "product-imgs/magpower-15-opb-7102w-1.webp",
    },
    {
      name: "Oraimo Lite Earphones",
      description: "Wireless comfort with crisp sound output.",
      categories: ["lounge", "flights"],
      price: 126.98,
      oldPrice: 240,
      badge: "-47%",
      badgeType: "sale",
      color: "linear-gradient(135deg,#fff0f5,#ffd6e8)",
      stockQty: 18,
      isActive: true,
      imageUrl: "product-imgs/oraimo-BoomPop-Pro-OHP-917-wireless-headphones-GREY.webp",
    },
    {
      name: "Oraimo CleanSip Faucet",
      description: "Smart faucet accessory for cleaner water flow.",
      categories: ["lounge", "insurance"],
      price: 217,
      oldPrice: 400,
      badge: "-42%",
      badgeType: "sale",
      color: "linear-gradient(135deg,#fff8e8,#ffecc0)",
      stockQty: 60,
      isActive: true,
      imageUrl: "product-imgs/wireless-earphones-spacebuds-neo-plus-otw-323p-black.webp",
    },
    {
      name: "Oraimo NutriFry Max Air",
      description: "Efficient air-fryer technology for quick meals.",
      categories: ["upgrades", "essentials"],
      price: 1078.92,
      oldPrice: 1800,
      badge: "-39%",
      badgeType: "sale",
      color: "linear-gradient(135deg,#f0e8ff,#dcc0ff)",
      stockQty: 50,
      isActive: true,
      imageUrl: "product-imgs/oraimo-watch-muse-OSW-831N-4.webp",
    },
    {
      name: "Oraimo Smart Trimmer",
      description: "Precision grooming with long-lasting blades.",
      categories: ["upgrades", "insurance"],
      price: 183.89,
      oldPrice: 350,
      badge: "-47%",
      badgeType: "sale",
      color: "linear-gradient(135deg,#e8fff5,#c0f5e0)",
      stockQty: 20,
      isActive: true,
      imageUrl: "product-imgs/africa-en-galaxy-s26-ultra-s948-sm-s948bzvoafb-thumb-551361084.webp",
    },
    {
      name: "Oraimo Wireless Charger",
      description: "Fast wireless charging for multiple devices.",
      categories: ["essentials", "flights"],
      price: 183.89,
      oldPrice: 350,
      badge: "-47%",
      badgeType: "sale",
      color: "linear-gradient(135deg,#e8f5ff,#c0e0ff)",
      stockQty: 100,
      isActive: true,
      imageUrl: "product-imgs/AI-appliances_v21.avif",
    },
    {
      name: "Pepsodent Tooth Paste",
      description: "Daily oral care essential for the whole family.",
      categories: ["insurance", "essentials"],
      price: 2631.9,
      oldPrice: 4900,
      badge: "-47%",
      badgeType: "sale",
      color: "linear-gradient(135deg,#e8ffee,#c0f0ce)",
      stockQty: 80,
      isActive: true,
      imageUrl: "product-imgs/personal-care/36024a.jpg",
    },
    {
      name: "Close Up Tooth Paste",
      description: "Fresh breath toothpaste with active formula.",
      categories: ["insurance", "essentials"],
      price: 136.9,
      oldPrice: 300,
      badge: "-56%",
      badgeType: "sale",
      color: "linear-gradient(135deg,#ffe8e8,#ffc0c0)",
      stockQty: 70,
      isActive: true,
      imageUrl: "product-imgs/personal-care/67728a.jpg",
    },
    {
      name: "Kel Mouth Wash",
      description: "Deep-clean mouthwash for complete care.",
      categories: ["insurance", "essentials"],
      price: 126.98,
      oldPrice: 240,
      badge: "-47%",
      badgeType: "sale",
      color: "linear-gradient(135deg,#f6e8ff,#e6c7ff)",
      stockQty: 70,
      isActive: true,
      imageUrl: "product-imgs/personal-care/70100a.jpg",
    },
    {
      name: "Oral B Tooth Brush",
      description: "Durable toothbrush designed for comfort.",
      categories: ["insurance", "essentials"],
      price: 217,
      oldPrice: 400,
      badge: "-42%",
      badgeType: "sale",
      color: "linear-gradient(135deg,#e8f7ff,#c7e9ff)",
      stockQty: 70,
      isActive: true,
      imageUrl: "product-imgs/personal-care/94947a.jpg",
    },
  ];

  state.products = seed.map((item) =>
    normalizeProductRecord({
      ...item,
      _id: makeId(),
      createdAt: now,
      updatedAt: now,
    })
  );

  await persistState();
}

async function seedAdminIfConfigured() {
  const email = process.env.ADMIN_EMAIL;
  if (!email) return;

  const normalizedEmail = normalizeEmail(email);
  const existing = state.users.find((user) => user.email === normalizedEmail);
  if (existing && existing.role === "admin") return;

  const passwordHash = process.env.ADMIN_PASSWORD_HASH || null;
  const password = process.env.ADMIN_PASSWORD || null;
  if (!passwordHash && !password) {
    throw new Error("In memory mode, set ADMIN_PASSWORD or ADMIN_PASSWORD_HASH.");
  }

  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 12);
  const hash = password ? await bcrypt.hash(String(password), saltRounds) : String(passwordHash);

  const user = existing || {
    _id: makeId(),
    name: process.env.ADMIN_NAME ? String(process.env.ADMIN_NAME).trim() : "Admin",
    email: normalizedEmail,
    role: "admin",
    createdAt: new Date(),
  };

  user.name = user.name || (process.env.ADMIN_NAME ? String(process.env.ADMIN_NAME).trim() : "Admin");
  user.role = "admin";
  user.passwordHash = hash;
  user.updatedAt = new Date();

  if (!existing) state.users.push(normalizeUserRecord(user));
  await persistState();
}

function productMatchesQuery(product, query) {
  if (!query) return true;
  const needle = String(query).trim().toLowerCase();
  if (!needle) return true;
  const hay = `${product.name} ${product.description} ${product.category} ${product.categories.join(" ")}`.toLowerCase();
  return hay.includes(needle);
}

function mapProductOut(product) {
  const categories = normalizeCategoryList(product.categories, product.category);
  const reviewSummary = normalizeProductReviews(product);
  return {
    id: String(product._id),
    name: product.name,
    price: product.price,
    desc: product.description,
    cat: categories[0],
    categories,
    oldPrice: product.oldPrice ?? null,
    imageUrl: product.imageUrl ?? null,
    badge: product.badge ?? null,
    badgeType: product.badgeType ?? null,
    icon: product.icon ?? null,
    color: product.color ?? null,
    ratingAverage: reviewSummary.averageRating,
    reviewCount: reviewSummary.reviewCount,
    reviews: reviewSummary.reviews,
    isActive: Boolean(product.isActive),
    stockQty: product.stockQty ?? 0,
  };
}

async function ensureAdminSeed() {
  await seedAdminIfConfigured();
  await seedDefaultProductsIfEmpty();
}

async function findUserByEmail(email) {
  const target = normalizeEmail(email);
  return state.users.find((user) => user.email === target) || null;
}

async function findUserById(id) {
  const target = String(id);
  return state.users.find((user) => String(user._id) === target) || null;
}

async function createUser({ name, email, passwordHash, role, phone, loyaltyPoints }) {
  const now = new Date();
  const user = normalizeUserRecord({
    _id: makeId(),
    name,
    email,
    passwordHash,
    role,
    phone,
    loyaltyPoints,
    createdAt: now,
    updatedAt: now,
  });
  state.users.push(user);
  await persistState();
  return user;
}

async function updateUserProfile(id, payload = {}) {
  const user = await findUserById(id);
  if (!user) return null;

  if (payload.phone !== undefined) {
    user.phone = payload.phone ? String(payload.phone).trim() : null;
  }
  if (payload.billingProfile !== undefined) {
    user.billingProfile = normalizeBillingProfile(payload.billingProfile);
  }
  if (payload.name !== undefined) {
    user.name = String(payload.name || "").trim() || user.name;
  }
  if (payload.loyaltyPoints !== undefined) {
    user.loyaltyPoints = Math.max(0, Math.floor(Number(payload.loyaltyPoints || 0)));
  }

  user.updatedAt = new Date();
  await persistState();
  return user;
}

async function listUsersAdmin() {
  const users = [...state.users].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return {
    users: users.map((user) => ({
      id: String(user._id),
      name: user.name,
      email: user.email,
      phone: user.phone || null,
      loyaltyPoints: Math.max(0, Math.floor(Number(user.loyaltyPoints || 0))),
      loyalty: buildLoyaltyProfile(user.loyaltyPoints),
      billingProfile: normalizeBillingProfile(user.billingProfile),
      role: user.role,
      createdAt: toISO(user.createdAt),
      updatedAt: toISO(user.updatedAt),
    })),
  };
}

async function listProductsPublic({ page, limit, q, category, minPrice, maxPrice }) {
  const currentPage = Math.max(1, page || 1);
  const pageSize = Math.min(Math.max(1, limit || 12), 50);

  let filtered = state.products.filter((product) => product.isActive === true);

  if (category) {
    const categoryToken = normalizeCategoryToken(category);
    filtered = filtered.filter((product) =>
      normalizeCategoryList(product.categories, product.category).some(
        (value) => normalizeCategoryToken(value) === categoryToken
      )
    );
  }

  if (minPrice != null || maxPrice != null) {
    filtered = filtered.filter((product) => {
      if (minPrice != null && product.price < minPrice) return false;
      if (maxPrice != null && product.price > maxPrice) return false;
      return true;
    });
  }

  if (q) filtered = filtered.filter((product) => productMatchesQuery(product, q));

  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const items = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return {
    products: items.map(mapProductOut),
    pagination: { page: currentPage, limit: pageSize, totalPages, totalItems },
  };
}

async function listProductsAdmin() {
  const products = [...state.products].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return { products: products.map(mapProductOut) };
}

async function createProduct(payload) {
  const now = new Date();
  const product = normalizeProductRecord({
    _id: makeId(),
    ...payload,
    createdAt: now,
    updatedAt: now,
  });
  state.products.push(product);
  await persistState();
  return mapProductOut(product);
}

async function updateProduct(id, payload) {
  const target = String(id);
  const product = state.products.find((item) => String(item._id) === target);
  if (!product) return null;

  const nextCategories =
    payload.categories !== undefined || payload.category !== undefined
      ? normalizeCategoryList(payload.categories, payload.category || product.category)
      : normalizeCategoryList(product.categories, product.category);

  Object.assign(product, {
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.price !== undefined ? { price: payload.price } : {}),
    ...(payload.description !== undefined ? { description: payload.description } : {}),
    ...(payload.stockQty !== undefined ? { stockQty: payload.stockQty } : {}),
    ...(payload.oldPrice !== undefined ? { oldPrice: payload.oldPrice } : {}),
    ...(payload.imageUrl !== undefined ? { imageUrl: payload.imageUrl } : {}),
    ...(payload.badge !== undefined ? { badge: payload.badge } : {}),
    ...(payload.badgeType !== undefined ? { badgeType: payload.badgeType } : {}),
    ...(payload.icon !== undefined ? { icon: payload.icon } : {}),
    ...(payload.color !== undefined ? { color: payload.color } : {}),
    ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
    category: nextCategories[0],
    categories: nextCategories,
    updatedAt: new Date(),
  });

  await persistState();
  return mapProductOut(product);
}

async function addProductReview(id, payload = {}) {
  const target = String(id);
  const product = state.products.find((item) => String(item._id) === target);
  if (!product) return null;

  const review = normalizeStoredReview({
    author: payload.author,
    rating: payload.rating,
    title: payload.title,
    comment: payload.comment,
    verifiedPurchase: payload.verifiedPurchase,
    createdAt: payload.createdAt || new Date(),
  });

  product.reviews = [review, ...(Array.isArray(product.reviews) ? product.reviews : [])];

  const reviewSummary = normalizeProductReviews(product);
  product.ratingAverage = reviewSummary.averageRating;
  product.reviewCount = reviewSummary.reviewCount;
  product.updatedAt = new Date();

  await persistState();
  return mapProductOut(product);
}

async function deleteProduct(id) {
  const target = String(id);
  const index = state.products.findIndex((product) => String(product._id) === target);
  if (index === -1) return null;
  const [removed] = state.products.splice(index, 1);
  await persistState();
  return mapProductOut(removed);
}

async function createOrder(payload) {
  const now = new Date();
  const order = normalizeOrderRecord({
    _id: makeId(),
    ...payload,
    statusHistory: [
      normalizeStatusHistoryEntry({
        status: payload.status || "placed",
        note: payload.initialNote || "Order placed",
        actorId: payload.userId || null,
        actorEmail: payload.customerEmail || null,
        createdAt: now,
      }),
    ],
    createdAt: now,
    updatedAt: now,
  });

  state.orders.push(order);
  await persistState();
  return mapOrderOut(order);
}

function orderMatchesSearch(order, query) {
  if (!query) return true;
  const needle = String(query).trim().toLowerCase();
  if (!needle) return true;
  const haystack = `${order.reference} ${order.customerName} ${order.customerEmail} ${order.status}`.toLowerCase();
  return haystack.includes(needle);
}

async function listOrdersForUser({ userId, email }) {
  const normalizedEmail = normalizeEmail(email);
  const rows = state.orders
    .filter((order) => (
      (userId && String(order.userId || "") === String(userId))
      || (normalizedEmail && order.customerEmail === normalizedEmail)
    ))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return { orders: rows.map(mapOrderOut) };
}

async function lookupOrderByReference({ reference, email }) {
  const normalizedReference = String(reference || "").trim().toUpperCase();
  const normalizedEmail = normalizeEmail(email);
  const order = state.orders.find((entry) =>
    String(entry.reference || "").trim().toUpperCase() === normalizedReference
    && entry.customerEmail === normalizedEmail
  );
  return order ? mapOrderOut(order) : null;
}

async function listOrdersAdmin({ status, q, limit }) {
  const pageSize = Math.min(Math.max(1, Number(limit || 50)), 5000);
  let rows = [...state.orders];
  if (status) {
    const targetStatus = String(status).trim().toLowerCase();
    rows = rows.filter((order) => String(order.status || "").trim().toLowerCase() === targetStatus);
  }
  if (q) rows = rows.filter((order) => orderMatchesSearch(order, q));
  rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return { orders: rows.slice(0, pageSize).map(mapOrderOut) };
}

async function updateOrderStatus(id, { status, note, actorId, actorEmail }) {
  const order = state.orders.find((entry) => String(entry._id) === String(id));
  if (!order) return null;

  order.status = String(status || order.status).trim() || order.status;
  order.statusHistory.push(
    normalizeStatusHistoryEntry({
      status: order.status,
      note: note || "",
      actorId: actorId || null,
      actorEmail: actorEmail || null,
      createdAt: new Date(),
    })
  );
  order.updatedAt = new Date();
  await persistState();
  return mapOrderOut(order);
}

async function addTrackingEvent(payload) {
  state.tracking.push(
    normalizeTrackingRecord({
      _id: makeId(),
      ...payload,
      createdAt: new Date(),
    })
  );
  await persistState();
  return { ok: true };
}

async function listTrackingEvents({ limit, since, eventType } = {}) {
  let rows = [...state.tracking];

  if (since) {
    const sinceTime = new Date(since).getTime();
    if (!Number.isNaN(sinceTime)) {
      rows = rows.filter((entry) => new Date(entry.createdAt).getTime() >= sinceTime);
    }
  }

  if (eventType) {
    const target = String(eventType).trim().toLowerCase();
    rows = rows.filter((entry) => String(entry.eventType || "").trim().toLowerCase() === target);
  }

  rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const pageSize = Math.min(Math.max(1, Number(limit || rows.length || 1)), 10000);
  return { events: rows.slice(0, pageSize).map(mapTrackingOut) };
}

async function addAuditLog({ actorId, action, entityType, entityId, summary }) {
  const actor = actorId ? await findUserById(actorId) : null;
  state.audit.push(
    normalizeAuditRecord({
      _id: makeId(),
      actorId: actorId || null,
      action,
      entityType,
      entityId: entityId || null,
      summary: summary || "",
      actorEmail: actor ? actor.email : null,
      createdAt: new Date(),
    })
  );
  await persistState();
}

async function listRecentAudit({ limit }) {
  const pageSize = Math.min(Number(limit || 20), 100);
  const rows = [...state.audit]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, pageSize);

  return {
    actions: rows.map((record) => ({
      action: record.action,
      entity_type: record.entityType,
      entity_id: record.entityId,
      summary: record.summary,
      actor_email: record.actorEmail,
      created_at: toISO(record.createdAt),
    })),
  };
}

module.exports = {
  mode: "memory",
  ensureAdminSeed,
  isValidId: () => true,
  user: {
    findByEmail: findUserByEmail,
    findById: findUserById,
    create: createUser,
    updateProfile: updateUserProfile,
    listAdmin: listUsersAdmin,
  },
  product: {
    listPublic: listProductsPublic,
    listAdmin: listProductsAdmin,
    create: createProduct,
    update: updateProduct,
    addReview: addProductReview,
    delete: deleteProduct,
  },
  audit: {
    add: addAuditLog,
    listRecent: listRecentAudit,
  },
  order: {
    create: createOrder,
    listForUser: listOrdersForUser,
    lookupByReference: lookupOrderByReference,
    listAdmin: listOrdersAdmin,
    updateStatus: updateOrderStatus,
  },
  tracking: {
    add: addTrackingEvent,
    list: listTrackingEvents,
  },
  cms: {
    getHome: async () => state.cms.home,
    setHome: async (value) => {
      state.cms.home = value;
      await persistState();
      return state.cms.home;
    },
    getShop: async () => state.cms.shop,
    setShop: async (value) => {
      state.cms.shop = value;
      await persistState();
      return state.cms.shop;
    },
    getAi: async () => state.cms.ai,
    setAi: async (value) => {
      state.cms.ai = value;
      await persistState();
      return state.cms.ai;
    },
    getDeals: async () => state.cms.deals,
    setDeals: async (value) => {
      state.cms.deals = value;
      await persistState();
      return state.cms.deals;
    },
    getFaq: async () => state.cms.faq,
    setFaq: async (value) => {
      state.cms.faq = value;
      await persistState();
      return state.cms.faq;
    },
    getAbout: async () => state.cms.about,
    setAbout: async (value) => {
      state.cms.about = value;
      await persistState();
      return state.cms.about;
    },
    getReports: async () => state.cms.reports,
    setReports: async (value) => {
      state.cms.reports = value;
      await persistState();
      return state.cms.reports;
    },
  },
  getAuthUserResponse,
};
