const fs = require("fs");
const path = require("path");

const Product = require("../models/Product");
const CmsConfig = require("../models/CmsConfig");

const MEMORY_STATE_PATH = path.join(__dirname, "..", "storage", "memory-state.json");
const CMS_KEYS = ["home", "shop", "ai", "deals", "faq", "about", "reports", "delivery", "adminPage"];

function normalizeString(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value == null) return fallback;
  return Boolean(value);
}

function normalizeDate(value, fallback = new Date()) {
  const date = value instanceof Date ? value : new Date(value || fallback);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function normalizeCategoryList(categories, fallbackCategory) {
  const source = Array.isArray(categories)
    ? categories
    : typeof categories === "string"
      ? categories.split(",")
      : [];

  const seen = new Set();
  const normalized = source
    .map((value) => normalizeString(value))
    .filter((value) => {
      const token = value.toLowerCase();
      if (!value || seen.has(token)) return false;
      seen.add(token);
      return true;
    });

  if (normalized.length) return normalized;

  const fallback = normalizeString(fallbackCategory, "general");
  return [fallback];
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function readMemoryState() {
  if (!fs.existsSync(MEMORY_STATE_PATH)) return null;

  try {
    return JSON.parse(fs.readFileSync(MEMORY_STATE_PATH, "utf8"));
  } catch (error) {
    console.warn("Failed to read memory storefront state:", error?.message || error);
    return null;
  }
}

function buildProductPayload(product = {}) {
  const categories = normalizeCategoryList(product.categories, product.category);
  const reviews = (Array.isArray(product.reviews) ? product.reviews : [])
    .map((review) => ({
      author: normalizeString(review?.author),
      rating: Math.max(1, Math.min(5, normalizeNumber(review?.rating, 5))),
      title: normalizeString(review?.title),
      comment: normalizeString(review?.comment || review?.body),
      verifiedPurchase: review?.verifiedPurchase !== false,
      createdAt: normalizeDate(review?.createdAt),
    }))
    .filter((review) => review.author && review.comment);

  return {
    name: normalizeString(product.name),
    price: Math.max(0, normalizeNumber(product.price, 0)),
    description: normalizeString(product.description || product.desc),
    category: categories[0],
    categories,
    stockQty: Math.max(0, Math.floor(normalizeNumber(product.stockQty, 0))),
    imageUrl: normalizeString(product.imageUrl) || null,
    oldPrice: product.oldPrice == null || product.oldPrice === "" ? null : Math.max(0, normalizeNumber(product.oldPrice, 0)),
    badge: normalizeString(product.badge) || null,
    badgeType: normalizeString(product.badgeType) || null,
    icon: normalizeString(product.icon) || null,
    color: normalizeString(product.color) || null,
    ratingAverage:
      product.ratingAverage == null || product.ratingAverage === ""
        ? null
        : Math.max(1, Math.min(5, normalizeNumber(product.ratingAverage, 5))),
    reviewCount: Math.max(0, Math.floor(normalizeNumber(product.reviewCount, reviews.length))),
    reviews,
    isActive: normalizeBoolean(product.isActive, true),
    createdAt: normalizeDate(product.createdAt),
    updatedAt: normalizeDate(product.updatedAt || product.createdAt),
  };
}

function remapDeals(deals, memoryToMongoProductIds) {
  return (Array.isArray(deals) ? deals : []).map((deal) => {
    const nextDeal = cloneJson(deal) || {};
    const nextIds = (Array.isArray(nextDeal.productIds) ? nextDeal.productIds : [])
      .map((id) => memoryToMongoProductIds.get(String(id)))
      .filter(Boolean);

    return {
      ...nextDeal,
      productIds: nextIds,
    };
  });
}

async function backfillProductsFromMemoryState(memoryProducts = []) {
  const entries = Array.isArray(memoryProducts) ? memoryProducts : [];
  if (!entries.length) return { inserted: 0, mappedIds: new Map() };
  const shouldSyncExisting = String(process.env.SYNC_MEMORY_STATE_TO_MONGO || "").trim().toLowerCase() === "true";

  const requestedNames = [...new Set(
    entries.map((product) => normalizeString(product?.name)).filter(Boolean)
  )];
  const existing = await Product.find({ name: { $in: requestedNames } }).select("_id name").lean();
  const byName = new Map(
    existing.map((product) => [normalizeString(product.name).toLowerCase(), String(product._id)])
  );
  const memoryToMongoProductIds = new Map();
  const missingPayloads = [];
  const missingEntries = [];
  const updates = [];

  entries.forEach((product) => {
    const name = normalizeString(product?.name);
    if (!name) return;

    const existingId = byName.get(name.toLowerCase());
    if (existingId) {
      memoryToMongoProductIds.set(String(product?._id || ""), existingId);
      if (shouldSyncExisting) {
        updates.push({
          updateOne: {
            filter: { _id: existingId },
            update: { $set: buildProductPayload(product) },
          },
        });
      }
      return;
    }

    missingEntries.push(product);
    missingPayloads.push(buildProductPayload(product));
  });

  let inserted = 0;
  if (missingPayloads.length) {
    const createdDocs = await Product.insertMany(missingPayloads, { ordered: true });
    createdDocs.forEach((doc, index) => {
      const source = missingEntries[index];
      const nextId = String(doc._id);
      const sourceId = String(source?._id || "");
      if (sourceId) memoryToMongoProductIds.set(sourceId, nextId);
      byName.set(normalizeString(doc.name).toLowerCase(), nextId);
    });
    inserted = createdDocs.length;
  }

  let updated = 0;
  if (updates.length) {
    const result = await Product.bulkWrite(updates, { ordered: true });
    updated = Number(result?.modifiedCount || 0);
  }

  entries.forEach((product) => {
    const sourceId = String(product?._id || "");
    if (!sourceId) return;
    const name = normalizeString(product?.name).toLowerCase();
    const mongoId = byName.get(name);
    if (mongoId) memoryToMongoProductIds.set(sourceId, mongoId);
  });

  return { inserted, updated, mappedIds: memoryToMongoProductIds };
}

async function backfillCmsFromMemoryState(memoryCms = {}, memoryToMongoProductIds = new Map()) {
  const source = memoryCms && typeof memoryCms === "object" ? memoryCms : {};
  const shouldSyncExisting = String(process.env.SYNC_MEMORY_STATE_TO_MONGO || "").trim().toLowerCase() === "true";
  const existingDocs = await CmsConfig.find({ key: { $in: CMS_KEYS } }).select("key").lean();
  const existingKeys = new Set(existingDocs.map((doc) => String(doc.key)));
  const docsToInsert = [];
  const updates = [];

  CMS_KEYS.forEach((key) => {
    const value = key === "deals"
      ? remapDeals(source[key], memoryToMongoProductIds)
      : cloneJson(source[key]);

    if (source[key] == null) return;
    if (existingKeys.has(key)) {
      if (shouldSyncExisting) {
        updates.push({
          updateOne: {
            filter: { key },
            update: { $set: { value } },
          },
        });
      }
      return;
    }

    docsToInsert.push({ key, value });
  });

  if (docsToInsert.length) {
    await CmsConfig.insertMany(docsToInsert, { ordered: true });
  }

  let updated = 0;
  if (updates.length) {
    const result = await CmsConfig.bulkWrite(updates, { ordered: true });
    updated = Number(result?.modifiedCount || 0);
  }

  return { inserted: docsToInsert.length, updated };
}

async function backfillMongoStorefrontFromMemoryState() {
  if (String(process.env.DISABLE_MEMORY_STATE_BACKFILL || "").trim().toLowerCase() === "true") {
    return { skipped: true, insertedProducts: 0, updatedProducts: 0, insertedCms: 0, updatedCms: 0 };
  }

  const memoryState = readMemoryState();
  if (!memoryState) return { skipped: true, insertedProducts: 0, updatedProducts: 0, insertedCms: 0, updatedCms: 0 };

  const { inserted: insertedProducts, updated: updatedProducts, mappedIds } = await backfillProductsFromMemoryState(memoryState.products);
  const { inserted: insertedCms, updated: updatedCms } = await backfillCmsFromMemoryState(memoryState.cms, mappedIds);

  if (insertedProducts || updatedProducts || insertedCms || updatedCms) {
    console.log(
      `Backfilled Mongo storefront data from memory-state: ${insertedProducts} inserted product(s), ${updatedProducts} updated product(s), ${insertedCms} inserted CMS record(s), ${updatedCms} updated CMS record(s).`
    );
  }

  return {
    skipped: false,
    insertedProducts,
    updatedProducts,
    insertedCms,
    updatedCms,
  };
}

module.exports = { backfillMongoStorefrontFromMemoryState };
