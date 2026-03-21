const crypto = require("crypto");
const bcrypt = require("bcrypt");

function makeId() {
  return crypto.randomUUID();
}

const state = {
  users: [],
  products: [],
  audit: [],
  cms: {
    home: {
      adImages: [
        "product-imgs/ad/ad1.png",
        "product-imgs/ad/ad2.png",
        "product-imgs/ad/ad3.png",
      ],
    },
    shop: {
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
    },
    deals: [
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
    ],
    ai: {
      chatEnabled: true,
      searchEnabled: true,
      botName: "Blustup AI",
      systemPrompt:
        "You are a helpful shopping assistant for Blustup. Answer concisely and recommend relevant products.",
    },
  },
};

async function seedDefaultProductsIfEmpty() {
  if (state.products.length > 0) return;

  // A small usable catalog so the shop page renders on first run.
  // (Matches your existing UI fields: `cat`, `desc`, `oldPrice`, `imageUrl`, etc.)
  const now = new Date();
  const seed = [
    {
      name: "Oraimo Maxi Watch",
      description: "Smart wearable with advanced battery life.",
      category: "flights",
      price: 2631.9,
      oldPrice: 4900,
      badge: "-47%",
      badgeType: null,
      icon: null,
      color: "linear-gradient(135deg,#e8f0ff,#d0dcff)",
      stockQty: 25,
      isActive: true,
      imageUrl: "product-imgs/1.jpg",
    },
    {
      name: "Oraimo Power Bank Lite",
      description: "Portable, durable power backup for daily use.",
      category: "flights",
      price: 136.9,
      oldPrice: 300,
      badge: "-56%",
      badgeType: "sale",
      icon: null,
      color: "linear-gradient(135deg,#e8f0ff,#d0dcff)",
      stockQty: 10,
      isActive: true,
      imageUrl: "product-imgs/magpower-15-opb-7102w-1.webp",
    },
    {
      name: "Oraimo Lite Earphones",
      description: "Wireless comfort with crisp sound output.",
      category: "lounge",
      price: 126.98,
      oldPrice: 240,
      badge: "-47%",
      badgeType: "sale",
      icon: null,
      color: "linear-gradient(135deg,#fff0f5,#ffd6e8)",
      stockQty: 18,
      isActive: true,
      imageUrl: "product-imgs/oraimo-BoomPop-Pro-OHP-917-wireless-headphones-GREY.webp",
    },
    {
      name: "Oraimo CleanSip Faucet",
      description: "Smart faucet accessory for cleaner water flow.",
      category: "lounge",
      price: 217,
      oldPrice: 400,
      badge: "-42%",
      badgeType: "sale",
      icon: null,
      color: "linear-gradient(135deg,#fff8e8,#ffecc0)",
      stockQty: 60,
      isActive: true,
      imageUrl: "product-imgs/wireless-earphones-spacebuds-neo-plus-otw-323p-black.webp",
    },
    {
      name: "Oraimo NutriFry Max Air",
      description: "Efficient air-fryer technology for quick meals.",
      category: "upgrades",
      price: 1078.92,
      oldPrice: 1800,
      badge: "-39%",
      badgeType: "sale",
      icon: null,
      color: "linear-gradient(135deg,#f0e8ff,#dcc0ff)",
      stockQty: 50,
      isActive: true,
      imageUrl: "product-imgs/oraimo-watch-muse-OSW-831N-4.webp",
    },
    {
      name: "Oraimo Smart Trimmer",
      description: "Precision grooming with long-lasting blades.",
      category: "upgrades",
      price: 183.89,
      oldPrice: 350,
      badge: "-47%",
      badgeType: "sale",
      icon: null,
      color: "linear-gradient(135deg,#e8fff5,#c0f5e0)",
      stockQty: 20,
      isActive: true,
      imageUrl: "product-imgs/africa-en-galaxy-s26-ultra-s948-sm-s948bzvoafb-thumb-551361084.webp",
    },
    {
      name: "Oraimo Wireless Charger",
      description: "Fast wireless charging for multiple devices.",
      category: "essentials",
      price: 183.89,
      oldPrice: 350,
      badge: "-47%",
      badgeType: "sale",
      icon: null,
      color: "linear-gradient(135deg,#e8f5ff,#c0e0ff)",
      stockQty: 100,
      isActive: true,
      imageUrl: "product-imgs/AI-appliances_v21.avif",
    },
    {
      name: "Pepsodent Tooth Paste",
      description: "Daily oral care essential for the whole family.",
      category: "insurance",
      price: 2631.9,
      oldPrice: 4900,
      badge: "-47%",
      badgeType: "sale",
      icon: null,
      color: "linear-gradient(135deg,#e8ffee,#c0f0ce)",
      stockQty: 80,
      isActive: true,
      imageUrl: "product-imgs/personal-care/36024a.jpg",
    },
    {
      name: "Close Up Tooth Paste",
      description: "Fresh breath toothpaste with active formula.",
      category: "insurance",
      price: 136.9,
      oldPrice: 300,
      badge: "-56%",
      badgeType: "sale",
      icon: null,
      color: "linear-gradient(135deg,#ffe8e8,#ffc0c0)",
      stockQty: 70,
      isActive: true,
      imageUrl: "product-imgs/personal-care/67728a.jpg",
    },
    {
      name: "Kel Mouth Wash",
      description: "Deep-clean mouthwash for complete care.",
      category: "insurance",
      price: 126.98,
      oldPrice: 240,
      badge: "-47%",
      badgeType: "sale",
      icon: null,
      color: "linear-gradient(135deg,#f6e8ff,#e6c7ff)",
      stockQty: 70,
      isActive: true,
      imageUrl: "product-imgs/personal-care/70100a.jpg",
    },
    {
      name: "Oral B Tooth Brush",
      description: "Durable toothbrush designed for comfort.",
      category: "insurance",
      price: 217,
      oldPrice: 400,
      badge: "-42%",
      badgeType: "sale",
      icon: null,
      color: "linear-gradient(135deg,#e8f7ff,#c7e9ff)",
      stockQty: 70,
      isActive: true,
      imageUrl: "product-imgs/personal-care/94947a.jpg",
    },
  ];

  for (const item of seed) {
    state.products.push({
      _id: makeId(),
      name: item.name,
      price: item.price,
      description: item.description,
      category: item.category,
      stockQty: item.stockQty ?? 0,
      imageUrl: item.imageUrl ?? null,
      oldPrice: item.oldPrice ?? null,
      badge: item.badge ? String(item.badge) : null,
      badgeType: item.badgeType ? String(item.badgeType) : null,
      icon: item.icon ? String(item.icon) : null,
      color: item.color ? String(item.color) : null,
      isActive: item.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function toISO(d) {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

function getAuthUserResponse(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

async function seedAdminIfConfigured() {
  const email = process.env.ADMIN_EMAIL;
  if (!email) return;

  const normalizedEmail = normalizeEmail(email);
  const existing = state.users.find((u) => u.email === normalizedEmail);
  if (existing && existing.role === "admin") return;

  const passwordHash = process.env.ADMIN_PASSWORD_HASH || null;
  const password = process.env.ADMIN_PASSWORD || null;

  if (!passwordHash && !password) {
    throw new Error("In memory mode, set ADMIN_PASSWORD or ADMIN_PASSWORD_HASH.");
  }

  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 12);
  // If ADMIN_PASSWORD is provided, prefer it (easier local setup even if ADMIN_PASSWORD_HASH exists).
  const hash = password
    ? await bcrypt.hash(String(password), saltRounds)
    : String(passwordHash);

  const user = existing || {
    _id: makeId(),
    name: process.env.ADMIN_NAME ? String(process.env.ADMIN_NAME).trim() : "Admin",
    email: normalizedEmail,
    role: "admin",
  };

  user.name = user.name || (process.env.ADMIN_NAME ? String(process.env.ADMIN_NAME).trim() : "Admin");
  user.role = "admin";
  user.passwordHash = hash;

  if (!existing) state.users.push(user);
}

function isActiveFilter(product) {
  return product.isActive === true;
}

function productMatchesQuery(product, q) {
  if (!q) return true;
  const needle = String(q).trim().toLowerCase();
  if (!needle) return true;
  const hay = `${product.name} ${product.description} ${product.category}`.toLowerCase();
  return hay.includes(needle);
}

async function findUserByEmail(email) {
  const e = normalizeEmail(email);
  return state.users.find((u) => u.email === e) || null;
}

async function findUserById(id) {
  const s = String(id);
  return state.users.find((u) => String(u._id) === s) || null;
}

async function createUser({ name, email, passwordHash, role }) {
  const now = new Date();
  const user = {
    _id: makeId(),
    name: String(name).trim(),
    email: normalizeEmail(email),
    passwordHash,
    role: role || "user",
    createdAt: now,
    updatedAt: now,
  };
  state.users.push(user);
  return user;
}

async function ensureAdminSeed() {
  await seedAdminIfConfigured();
  await seedDefaultProductsIfEmpty();
}

async function listProductsPublic({ page, limit, q, category, minPrice, maxPrice }) {
  const p = Math.max(1, page || 1);
  const l = Math.min(Math.max(1, limit || 12), 50);

  let filtered = state.products.filter(isActiveFilter);

  if (category) filtered = filtered.filter((x) => x.category === category);
  if (minPrice != null || maxPrice != null) {
    filtered = filtered.filter((x) => {
      if (minPrice != null && x.price < minPrice) return false;
      if (maxPrice != null && x.price > maxPrice) return false;
      return true;
    });
  }
  if (q) filtered = filtered.filter((x) => productMatchesQuery(x, q));

  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / l));
  const items = filtered.slice((p - 1) * l, (p - 1) * l + l);

  return {
    products: items.map(mapProductOut),
    pagination: { page: p, limit: l, totalPages, totalItems },
  };
}

function mapProductOut(p) {
  return {
    id: String(p._id),
    name: p.name,
    price: p.price,
    desc: p.description,
    cat: p.category,
    oldPrice: p.oldPrice ?? null,
    imageUrl: p.imageUrl,
    badge: p.badge ?? null,
    badgeType: p.badgeType ?? null,
    icon: p.icon ?? null,
    color: p.color ?? null,
    isActive: Boolean(p.isActive),
    stockQty: p.stockQty ?? 0,
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
  const product = {
    _id: makeId(),
    name: payload.name,
    price: payload.price,
    description: payload.description,
    category: payload.category,
    stockQty: payload.stockQty ?? 0,
    imageUrl: payload.imageUrl ?? null,
    oldPrice: payload.oldPrice ?? null,
    badge: payload.badge ?? null,
    badgeType: payload.badgeType ?? null,
    icon: payload.icon ?? null,
    color: payload.color ?? null,
    isActive: payload.isActive ?? true,
    createdAt: now,
    updatedAt: now,
  };
  state.products.push(product);
  return mapProductOut(product);
}

async function updateProduct(id, payload) {
  const s = String(id);
  const p = state.products.find((x) => String(x._id) === s);
  if (!p) return null;

  // Apply only provided fields.
  if (payload.name != null) p.name = payload.name;
  if (payload.price != null) p.price = payload.price;
  if (payload.description != null) p.description = payload.description;
  if (payload.category != null) p.category = payload.category;
  if (payload.stockQty != null) p.stockQty = payload.stockQty;
  if (payload.oldPrice !== undefined) p.oldPrice = payload.oldPrice; // allow null
  if (payload.imageUrl !== undefined) p.imageUrl = payload.imageUrl; // allow null
  if (payload.badge !== undefined) p.badge = payload.badge; // allow null
  if (payload.badgeType !== undefined) p.badgeType = payload.badgeType; // allow null
  if (payload.icon !== undefined) p.icon = payload.icon; // allow null
  if (payload.color !== undefined) p.color = payload.color; // allow null
  if (payload.isActive !== undefined) p.isActive = payload.isActive;

  p.updatedAt = new Date();
  return mapProductOut(p);
}

async function deleteProduct(id) {
  const s = String(id);
  const idx = state.products.findIndex((x) => String(x._id) === s);
  if (idx === -1) return null;
  const [removed] = state.products.splice(idx, 1);
  return mapProductOut(removed);
}

async function addAuditLog({ actorId, action, entityType, entityId, summary }) {
  const actor = actorId ? await findUserById(actorId) : null;
  state.audit.push({
    _id: makeId(),
    actorId: actorId || null,
    action,
    entityType,
    entityId: entityId || null,
    summary: summary || "",
    actorEmail: actor ? actor.email : null,
    createdAt: new Date(),
  });
}

async function listRecentAudit({ limit }) {
  const l = Math.min(Number(limit || 20), 100);
  const rows = [...state.audit]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, l);

  return {
    actions: rows.map((a) => ({
      action: a.action,
      entity_type: a.entityType,
      entity_id: a.entityId,
      summary: a.summary,
      actor_email: a.actorEmail,
      created_at: toISO(a.createdAt),
    })),
  };
}

module.exports = {
  mode: "memory",
  ensureAdminSeed: ensureAdminSeed,
  isValidId: () => true,

  user: {
    findByEmail: findUserByEmail,
    findById: findUserById,
    create: createUser,
  },

  product: {
    listPublic: listProductsPublic,
    listAdmin: listProductsAdmin,
    create: createProduct,
    update: updateProduct,
    delete: deleteProduct,
  },

  audit: {
    add: addAuditLog,
    listRecent: listRecentAudit,
  },
  cms: {
    getHome: async () => state.cms.home,
    setHome: async (value) => {
      state.cms.home = value;
      return state.cms.home;
    },
    getShop: async () => state.cms.shop,
    setShop: async (value) => {
      state.cms.shop = value;
      return state.cms.shop;
    },
    getAi: async () => state.cms.ai,
    setAi: async (value) => {
      state.cms.ai = value;
      return state.cms.ai;
    },
    getDeals: async () => state.cms.deals,
    setDeals: async (value) => {
      state.cms.deals = value;
      return state.cms.deals;
    },
  },

  // helper
  getAuthUserResponse,
};

