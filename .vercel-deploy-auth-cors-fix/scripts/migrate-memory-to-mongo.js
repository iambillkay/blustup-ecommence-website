#!/usr/bin/env node
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const { connectDB } = require("../server/config/db");
const User = require("../server/models/User");
const Product = require("../server/models/Product");
const Order = require("../server/models/Order");
const Tracking = require("../server/models/Tracking");
const AuditLog = require("../server/models/AuditLog");
const CmsConfig = require("../server/models/CmsConfig");

const DEFAULT_MEMORY_STATE_PATH = path.join(__dirname, "..", "server", "storage", "memory-state.json");

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function toDate(value, fallback = new Date()) {
  const date = value instanceof Date ? value : new Date(value || fallback);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeString(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function normalizeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value == null) return fallback;
  return Boolean(value);
}

function normalizeCategoryList(categories, fallbackCategory) {
  const source = Array.isArray(categories)
    ? categories
    : typeof categories === "string"
      ? categories.split(",")
      : [];

  const seen = new Set();
  const items = source
    .map((value) => normalizeString(value))
    .filter((value) => {
      const token = value.toLowerCase();
      if (!value || seen.has(token)) return false;
      seen.add(token);
      return true;
    });

  if (items.length) return items;

  const fallback = normalizeString(fallbackCategory, "general");
  return [fallback];
}

function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);

  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
}

function buildTrackingSignature(entry) {
  return [
    normalizeString(entry.eventType),
    entry.userId ? String(entry.userId) : "",
    normalizeString(entry.sessionId),
    toDate(entry.createdAt).toISOString(),
    stableSerialize(entry.eventData || {}),
    normalizeString(entry.ipAddress),
    normalizeString(entry.userAgent),
  ].join("|");
}

function buildAuditSignature(entry) {
  return [
    entry.actor ? String(entry.actor) : "",
    normalizeString(entry.action),
    normalizeString(entry.entityType),
    normalizeString(entry.entityId),
    normalizeString(entry.summary),
    toDate(entry.createdAt).toISOString(),
  ].join("|");
}

function readMemoryState(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function upsertUsers(memoryUsers = [], dryRun = false) {
  const existingUsers = await User.find({}).select("_id email").lean();
  const byEmail = new Map(
    existingUsers
      .map((user) => [normalizeEmail(user.email), user])
      .filter(([email]) => email)
  );

  const userIdMap = new Map();
  let inserted = 0;
  let updated = 0;

  for (const user of Array.isArray(memoryUsers) ? memoryUsers : []) {
    const email = normalizeEmail(user?.email);
    if (!email) continue;

    const payload = {
      name: normalizeString(user?.name, "User"),
      email,
      passwordHash: normalizeString(user?.passwordHash),
      phone: normalizeString(user?.phone) || null,
      loyaltyPoints: Math.max(0, Math.floor(normalizeNumber(user?.loyaltyPoints, 0))),
      billingProfile: {
        firstName: normalizeString(user?.billingProfile?.firstName) || null,
        lastName: normalizeString(user?.billingProfile?.lastName) || null,
        street: normalizeString(user?.billingProfile?.street) || null,
        city: normalizeString(user?.billingProfile?.city) || null,
        state: normalizeString(user?.billingProfile?.state) || null,
        zip: normalizeString(user?.billingProfile?.zip) || null,
        country: normalizeString(user?.billingProfile?.country) || null,
      },
      role: normalizeString(user?.role, "user") === "admin" ? "admin" : "user",
      createdAt: toDate(user?.createdAt),
      updatedAt: toDate(user?.updatedAt || user?.createdAt),
    };

    const existing = byEmail.get(email);
    if (existing) {
      userIdMap.set(String(user?._id || ""), existing._id);
      if (!dryRun) {
        await User.collection.updateOne(
          { _id: existing._id },
          { $set: payload }
        );
      }
      updated += 1;
      continue;
    }

    const _id = new mongoose.Types.ObjectId();
    userIdMap.set(String(user?._id || ""), _id);
    byEmail.set(email, { _id, email });
    if (!dryRun) {
      await User.collection.insertOne({ _id, ...payload });
    }
    inserted += 1;
  }

  return { userIdMap, inserted, updated };
}

async function upsertProducts(memoryProducts = [], dryRun = false) {
  const existingProducts = await Product.find({}).select("_id name").lean();
  const byName = new Map(
    existingProducts
      .map((product) => [normalizeString(product.name).toLowerCase(), product])
      .filter(([name]) => name)
  );

  const productIdMap = new Map();
  let inserted = 0;
  let updated = 0;

  for (const product of Array.isArray(memoryProducts) ? memoryProducts : []) {
    const name = normalizeString(product?.name);
    if (!name) continue;

    const categories = normalizeCategoryList(product?.categories, product?.category);
    const normalizedReviews = (Array.isArray(product?.reviews) ? product.reviews : [])
      .map((review) => ({
        author: normalizeString(review?.author),
        rating: Math.max(1, Math.min(5, normalizeNumber(review?.rating, 5))),
        title: normalizeString(review?.title),
        comment: normalizeString(review?.comment || review?.body),
        verifiedPurchase: review?.verifiedPurchase !== false,
        createdAt: toDate(review?.createdAt),
      }))
      .filter((review) => review.author && review.comment);

    const payload = {
      name,
      price: Math.max(0, normalizeNumber(product?.price, 0)),
      description: normalizeString(product?.description || product?.desc),
      category: categories[0],
      categories,
      stockQty: Math.max(0, Math.floor(normalizeNumber(product?.stockQty, 0))),
      imageUrl: normalizeString(product?.imageUrl) || null,
      oldPrice: product?.oldPrice == null || product?.oldPrice === "" ? null : Math.max(0, normalizeNumber(product?.oldPrice, 0)),
      badge: normalizeString(product?.badge) || null,
      badgeType: normalizeString(product?.badgeType) || null,
      icon: normalizeString(product?.icon) || null,
      color: normalizeString(product?.color) || null,
      ratingAverage: product?.ratingAverage == null || product?.ratingAverage === "" ? null : Math.max(1, Math.min(5, normalizeNumber(product?.ratingAverage, 5))),
      reviewCount: Math.max(0, Math.floor(normalizeNumber(product?.reviewCount, normalizedReviews.length))),
      reviews: normalizedReviews,
      isActive: product?.isActive !== false,
      createdAt: toDate(product?.createdAt),
      updatedAt: toDate(product?.updatedAt || product?.createdAt),
    };

    const key = name.toLowerCase();
    const existing = byName.get(key);
    if (existing) {
      productIdMap.set(String(product?._id || ""), existing._id);
      if (!dryRun) {
        await Product.collection.updateOne(
          { _id: existing._id },
          { $set: payload }
        );
      }
      updated += 1;
      continue;
    }

    const _id = new mongoose.Types.ObjectId();
    productIdMap.set(String(product?._id || ""), _id);
    byName.set(key, { _id, name });
    if (!dryRun) {
      await Product.collection.insertOne({ _id, ...payload });
    }
    inserted += 1;
  }

  return { productIdMap, inserted, updated };
}

async function upsertOrders(memoryOrders = [], userIdMap, productIdMap, dryRun = false) {
  const existingOrders = await Order.find({}).select("_id reference").lean();
  const byReference = new Map(
    existingOrders
      .map((order) => [normalizeString(order.reference), order])
      .filter(([reference]) => reference)
  );

  let inserted = 0;
  let updated = 0;

  for (const order of Array.isArray(memoryOrders) ? memoryOrders : []) {
    const reference = normalizeString(order?.reference);
    if (!reference) continue;

    const payload = {
      reference,
      userId: userIdMap.get(String(order?.userId || "")) || null,
      sessionId: normalizeString(order?.sessionId) || null,
      customerName: normalizeString(order?.customerName, "Customer"),
      customerEmail: normalizeEmail(order?.customerEmail),
      customerPhone: normalizeString(order?.customerPhone) || null,
      billingAddress: {
        firstName: normalizeString(order?.billingAddress?.firstName) || null,
        lastName: normalizeString(order?.billingAddress?.lastName) || null,
        street: normalizeString(order?.billingAddress?.street) || null,
        city: normalizeString(order?.billingAddress?.city) || null,
        state: normalizeString(order?.billingAddress?.state) || null,
        zip: normalizeString(order?.billingAddress?.zip) || null,
        country: normalizeString(order?.billingAddress?.country) || null,
      },
      items: (Array.isArray(order?.items) ? order.items : [])
        .map((item) => ({
          productId: String(productIdMap.get(String(item?.productId || "")) || item?.productId || "").trim(),
          name: normalizeString(item?.name),
          price: Math.max(0, normalizeNumber(item?.price, 0)),
          qty: Math.max(1, Math.floor(normalizeNumber(item?.qty, 1))),
          imageUrl: normalizeString(item?.imageUrl) || null,
        }))
        .filter((item) => item.productId && item.name),
      paymentMethod: normalizeString(order?.paymentMethod, "card"),
      promoCode: normalizeString(order?.promoCode) || null,
      promoLabel: normalizeString(order?.promoLabel) || null,
      subtotal: Math.max(0, normalizeNumber(order?.subtotal, 0)),
      discount: Math.max(0, normalizeNumber(order?.discount, 0)),
      shipping: Math.max(0, normalizeNumber(order?.shipping, 0)),
      tax: Math.max(0, normalizeNumber(order?.tax, 0)),
      total: Math.max(0, normalizeNumber(order?.total, 0)),
      loyaltyEarned: Math.max(0, normalizeNumber(order?.loyaltyEarned, 0)),
      loyaltyBalanceAfter: Math.max(0, normalizeNumber(order?.loyaltyBalanceAfter, 0)),
      loyaltyTierAfter: normalizeString(order?.loyaltyTierAfter) || null,
      status: normalizeString(order?.status, "placed"),
      deliveryAssignment: order?.deliveryAssignment
        ? {
            id: normalizeString(order.deliveryAssignment.id) || null,
            riderId: normalizeString(order.deliveryAssignment.riderId) || null,
            riderName: normalizeString(order.deliveryAssignment.riderName) || null,
            riderEmail: normalizeEmail(order.deliveryAssignment.riderEmail) || null,
            riderPhone: normalizeString(order.deliveryAssignment.riderPhone) || null,
            coverage: normalizeString(order.deliveryAssignment.coverage) || null,
            status: normalizeString(order.deliveryAssignment.status) || null,
            note: normalizeString(order.deliveryAssignment.note),
            source: normalizeString(order.deliveryAssignment.source) || null,
            assignedAt: order.deliveryAssignment.assignedAt ? toDate(order.deliveryAssignment.assignedAt) : null,
            notifiedAt: order.deliveryAssignment.notifiedAt ? toDate(order.deliveryAssignment.notifiedAt) : null,
          }
        : null,
      statusHistory: (Array.isArray(order?.statusHistory) ? order.statusHistory : []).map((entry) => ({
        status: normalizeString(entry?.status, "placed"),
        note: normalizeString(entry?.note),
        actorId: userIdMap.get(String(entry?.actorId || "")) || null,
        actorEmail: normalizeEmail(entry?.actorEmail) || null,
        createdAt: toDate(entry?.createdAt),
      })),
      createdAt: toDate(order?.createdAt),
      updatedAt: toDate(order?.updatedAt || order?.createdAt),
    };

    const existing = byReference.get(reference);
    if (existing) {
      if (!dryRun) {
        await Order.collection.updateOne(
          { _id: existing._id },
          { $set: payload }
        );
      }
      updated += 1;
      continue;
    }

    const _id = new mongoose.Types.ObjectId();
    byReference.set(reference, { _id, reference });
    if (!dryRun) {
      await Order.collection.insertOne({ _id, ...payload });
    }
    inserted += 1;
  }

  return { inserted, updated };
}

async function mergeTracking(memoryTracking = [], userIdMap, dryRun = false) {
  const existingTracking = await Tracking.collection.find({}, {
    projection: {
      userId: 1,
      sessionId: 1,
      eventType: 1,
      eventData: 1,
      ipAddress: 1,
      userAgent: 1,
      createdAt: 1,
    },
  }).toArray();

  const signatures = new Set(existingTracking.map(buildTrackingSignature));
  const docs = [];

  for (const entry of Array.isArray(memoryTracking) ? memoryTracking : []) {
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      userId: userIdMap.get(String(entry?.userId || "")) || null,
      sessionId: normalizeString(entry?.sessionId) || null,
      eventType: normalizeString(entry?.eventType),
      eventData: entry?.eventData && typeof entry.eventData === "object" ? entry.eventData : {},
      ipAddress: normalizeString(entry?.ipAddress) || null,
      userAgent: normalizeString(entry?.userAgent) || null,
      createdAt: toDate(entry?.createdAt),
      updatedAt: toDate(entry?.createdAt),
    };

    if (!doc.eventType) continue;

    const signature = buildTrackingSignature(doc);
    if (signatures.has(signature)) continue;
    signatures.add(signature);
    docs.push(doc);
  }

  if (!dryRun && docs.length) {
    await Tracking.collection.insertMany(docs, { ordered: false });
  }

  return { inserted: docs.length };
}

async function mergeAudit(memoryAudit = [], userIdMap, dryRun = false) {
  const existingAudit = await AuditLog.collection.find({}, {
    projection: {
      actor: 1,
      action: 1,
      entityType: 1,
      entityId: 1,
      summary: 1,
      createdAt: 1,
    },
  }).toArray();

  const signatures = new Set(existingAudit.map(buildAuditSignature));
  const docs = [];

  for (const entry of Array.isArray(memoryAudit) ? memoryAudit : []) {
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      actor: userIdMap.get(String(entry?.actorId || "")) || null,
      action: normalizeString(entry?.action),
      entityType: normalizeString(entry?.entityType),
      entityId: normalizeString(entry?.entityId) || null,
      summary: normalizeString(entry?.summary),
      createdAt: toDate(entry?.createdAt),
      updatedAt: toDate(entry?.createdAt),
    };

    if (!doc.action || !doc.entityType || !doc.summary) continue;

    const signature = buildAuditSignature(doc);
    if (signatures.has(signature)) continue;
    signatures.add(signature);
    docs.push(doc);
  }

  if (!dryRun && docs.length) {
    await AuditLog.collection.insertMany(docs, { ordered: false });
  }

  return { inserted: docs.length };
}

async function upsertCms(cmsState = {}, productIdMap, dryRun = false) {
  const entries = Object.entries(cmsState && typeof cmsState === "object" ? cmsState : {});
  let updated = 0;

  for (const [key, rawValue] of entries) {
    const value = JSON.parse(JSON.stringify(rawValue));

    if (key === "deals" && Array.isArray(value)) {
      value.forEach((deal) => {
        if (!Array.isArray(deal?.productIds)) return;
        deal.productIds = deal.productIds.map((productId) => String(productIdMap.get(String(productId)) || productId));
      });
    }

    if (!dryRun) {
      await CmsConfig.findOneAndUpdate(
        { key },
        { $set: { value } },
        { upsert: true }
      );
    }
    updated += 1;
  }

  return { updated };
}

async function main() {
  const memoryStatePath = path.resolve(getArgValue("--file") || DEFAULT_MEMORY_STATE_PATH);
  const dryRun = hasFlag("--dry-run");

  if (!fs.existsSync(memoryStatePath)) {
    throw new Error(`Memory state file not found: ${memoryStatePath}`);
  }

  const state = readMemoryState(memoryStatePath);
  await connectDB();

  const usersResult = await upsertUsers(state.users, dryRun);
  const productsResult = await upsertProducts(state.products, dryRun);
  const ordersResult = await upsertOrders(state.orders, usersResult.userIdMap, productsResult.productIdMap, dryRun);
  const trackingResult = await mergeTracking(state.tracking, usersResult.userIdMap, dryRun);
  const auditResult = await mergeAudit(state.audit, usersResult.userIdMap, dryRun);
  const cmsResult = await upsertCms(state.cms, productsResult.productIdMap, dryRun);

  console.log(JSON.stringify({
    dryRun,
    file: memoryStatePath,
    users: { inserted: usersResult.inserted, updated: usersResult.updated },
    products: { inserted: productsResult.inserted, updated: productsResult.updated },
    orders: { inserted: ordersResult.inserted, updated: ordersResult.updated },
    tracking: trackingResult,
    audit: auditResult,
    cms: cmsResult,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error?.stack || error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch (_error) {
      // ignore disconnect errors on exit
    }
  });
