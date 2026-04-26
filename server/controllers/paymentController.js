const { z } = require("zod");

const storage = require("../storage");
const paystack = require("../services/paystackService");
const { buildLoyaltyProfile, calculateEarnedLoyaltyPoints } = require("../utils/storefront");
const { dispatchOrderToRider } = require("../services/deliveryDispatchService");

const TAX_RATE = 0.08;
const FREE_SHIPPING_THRESHOLD = 50;
const SHIPPING_FLAT_RATE = 5.99;
const KNOWN_PROMOS = {
  AIRLUME20: { percent: 0.2, label: "20% off (AIRLUME20)" },
  BLUSTUP10: { percent: 0.1, label: "10% off (BLUSTUP10)" },
  FREESHIP: { percent: 0, label: "Free shipping (FREESHIP)", freeShip: true },
};

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function normalizePromo(code) {
  const normalizedCode = String(code || "").trim().toUpperCase();
  if (!normalizedCode) return { code: null, percent: 0, label: null, freeShip: false };
  const promo = KNOWN_PROMOS[normalizedCode];
  if (!promo) return { code: null, percent: 0, label: null, freeShip: false };
  return {
    code: normalizedCode,
    percent: Number(promo.percent || 0),
    label: promo.label || normalizedCode,
    freeShip: Boolean(promo.freeShip),
  };
}

function makeReference() {
  const stamp = Date.now().toString(36).toUpperCase();
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `BLU-${stamp}-${randomPart}`;
}

function buildOrderStatusNote(status) {
  const notes = {
    placed: "Order received and queued for confirmation.",
    processing: "Your items are being prepared for dispatch.",
    shipped: "Your order is on the way.",
    delivered: "Your order has been delivered successfully.",
    cancelled: "This order has been cancelled.",
  };
  return notes[String(status || "").trim().toLowerCase()] || "Order status updated.";
}

const initializeSchema = z.object({
  sessionId: z.string().trim().max(120).optional().nullable(),
  promoCode: z.union([z.string().trim().max(40), z.literal(""), z.null()]).optional(),
  customer: z.object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(200).transform((v) => v.toLowerCase()),
    phone: z.string().trim().min(8).max(20),
  }),
  billingAddress: z.object({
    street: z.string().trim().min(1).max(160),
    city: z.string().trim().min(1).max(80),
    state: z.string().trim().min(1).max(80),
    zip: z.string().trim().min(1).max(20),
    country: z.string().trim().min(1).max(80),
  }),
  items: z.array(
    z.object({
      productId: z.string().trim().min(1).max(80),
      qty: z.number().int().min(1).max(99),
    })
  ).min(1).max(50),
});

function groupRequestedItems(items) {
  const grouped = new Map();
  for (const item of items) {
    const key = String(item.productId).trim();
    const qty = Math.max(1, Number(item.qty || 1));
    grouped.set(key, (grouped.get(key) || 0) + qty);
  }
  return grouped;
}

async function buildPricing(parsedData, authenticatedUser) {
  const { products } = await storage.product.listAdmin();
  const activeProducts = new Map(
    (Array.isArray(products) ? products : [])
      .filter((p) => p && p.isActive !== false)
      .map((p) => [String(p.id), p])
  );
  const loyalty = buildLoyaltyProfile(authenticatedUser?.loyaltyPoints);

  const grouped = groupRequestedItems(parsedData.items);
  const orderItems = [];

  for (const [productId, qty] of grouped.entries()) {
    const product = activeProducts.get(productId);
    if (!product) throw new Error("One or more products are unavailable.");
    if (Number(product.stockQty || 0) < qty) {
      throw new Error(`Only ${Number(product.stockQty || 0)} unit(s) of ${product.name} are available right now.`);
    }
    orderItems.push({
      productId,
      name: product.name,
      price: roundMoney(product.price),
      qty,
      imageUrl: product.imageUrl || null,
      stockQty: Number(product.stockQty || 0),
    });
  }

  const subtotal = roundMoney(orderItems.reduce((sum, item) => sum + item.price * item.qty, 0));
  const promo = normalizePromo(parsedData.promoCode);
  const discount = roundMoney(Math.min(subtotal, subtotal * promo.percent));
  const discountedSubtotal = roundMoney(Math.max(0, subtotal - discount));
  const shipping = roundMoney(
    promo.freeShip || loyalty.freeShippingEligible || discountedSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT_RATE
  );
  const tax = roundMoney((discountedSubtotal + shipping) * TAX_RATE);
  const total = roundMoney(discountedSubtotal + shipping + tax);
  const earnedPoints = authenticatedUser ? calculateEarnedLoyaltyPoints(total) : 0;

  return {
    items: orderItems.map(({ stockQty, ...item }) => item),
    stockReservations: orderItems.map((item) => ({ productId: item.productId, qty: item.qty, stockQty: item.stockQty })),
    promo,
    subtotal,
    discount,
    shipping,
    tax,
    total,
    earnedPoints,
    loyalty,
  };
}

function summarizeUser(user) {
  if (typeof storage.getAuthUserResponse === "function") {
    return storage.getAuthUserResponse(user);
  }
  return { id: user._id.toString(), name: user.name, email: user.email, role: user.role };
}

async function config(_req, res) {
  return res.json({
    publicKey: paystack.isConfigured() ? paystack.getPublicKey() : null,
    configured: paystack.isConfigured(),
  });
}

async function initialize(req, res) {
  if (!paystack.isConfigured()) {
    return res.status(503).json({ error: "Paystack is not configured. Add PAYSTACK_SECRET_KEY and PAYSTACK_PUBLIC_KEY to your .env file." });
  }

  const parsed = initializeSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid checkout details" });
  }

  try {
    const authenticatedUser = req.user?.sub ? await storage.user.findById(req.user.sub) : null;
    const pricing = await buildPricing(parsed.data, authenticatedUser);

    // Paystack uses smallest currency unit: pesewas for GHS (1 GHS = 100 pesewas)
    const amountPesewas = Math.round(pricing.total * 100);

    const paystackData = await paystack.initializeTransaction(
      parsed.data.customer.email,
      amountPesewas,
      {
        userId: req.user?.sub || null,
        sessionId: parsed.data.sessionId || null,
        customerName: `${parsed.data.customer.firstName} ${parsed.data.customer.lastName}`.trim(),
        customerPhone: parsed.data.customer.phone,
        billingAddress: parsed.data.billingAddress,
        promoCode: pricing.promo.code,
        items: parsed.data.items,
        pricing: {
          subtotal: pricing.subtotal,
          discount: pricing.discount,
          shipping: pricing.shipping,
          tax: pricing.tax,
          total: pricing.total,
        },
      }
    );

    return res.json({
      authorization_url: paystackData.authorization_url,
      access_code: paystackData.access_code,
      reference: paystackData.reference,
      total: pricing.total,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to initialize payment" });
  }
}

async function verify(req, res) {
  if (!paystack.isConfigured()) {
    return res.status(503).json({ error: "Paystack is not configured." });
  }

  const reference = String(req.params.reference || "").trim();
  if (!reference) {
    return res.status(400).json({ error: "Missing payment reference" });
  }

  try {
    const verification = await paystack.verifyTransaction(reference);

    if (verification.status !== "success") {
      return res.status(400).json({ error: `Payment ${verification.status}. Please try again.` });
    }

    const meta = verification.metadata || {};
    const pricingMeta = meta.pricing || {};
    const items = Array.isArray(meta.items) ? meta.items : [];
    const billingAddress = meta.billingAddress || {};

    if (!items.length) {
      return res.status(400).json({ error: "No items found in payment metadata." });
    }

    // Rebuild pricing from live catalog to ensure integrity
    const authenticatedUser = req.user?.sub ? await storage.user.findById(req.user.sub) : null;
    const pricing = await buildPricing({ items, promoCode: meta.promoCode }, authenticatedUser);

    // Verify amount matches (allow small rounding tolerance)
    const expectedPesewas = Math.round(pricing.total * 100);
    const paidPesewas = Number(verification.amount || 0);
    if (Math.abs(expectedPesewas - paidPesewas) > 5) {
      console.warn(`Paystack amount mismatch: expected ${expectedPesewas}, got ${paidPesewas}`);
      return res.status(400).json({ error: "Payment amount does not match order total. Contact support." });
    }

    // Reserve stock
    await reserveStock(pricing.stockReservations);

    const customerName = String(meta.customerName || "Customer").trim();
    const customerEmail = String(verification.customer?.email || meta.customerEmail || "").trim().toLowerCase();
    const loyaltyBalanceAfter = authenticatedUser
      ? Math.max(0, Number(authenticatedUser.loyaltyPoints || 0)) + pricing.earnedPoints
      : 0;
    const loyaltyAfterProfile = authenticatedUser ? buildLoyaltyProfile(loyaltyBalanceAfter) : null;

    let order;
    try {
      order = await storage.order.create({
        reference: makeReference(),
        userId: req.user?.sub || null,
        sessionId: meta.sessionId || null,
        customerName,
        customerEmail,
        customerPhone: meta.customerPhone || null,
        billingAddress,
        items: pricing.items,
        paymentMethod: "paystack",
        promoCode: pricing.promo.code,
        promoLabel: pricing.promo.label,
        subtotal: pricing.subtotal,
        discount: pricing.discount,
        shipping: pricing.shipping,
        tax: pricing.tax,
        total: pricing.total,
        loyaltyEarned: pricing.earnedPoints,
        loyaltyBalanceAfter,
        loyaltyTierAfter: loyaltyAfterProfile?.tierName || null,
        status: "placed",
        initialNote: buildOrderStatusNote("placed"),
        paystackReference: reference,
      });
    } catch (createError) {
      await restoreStock(pricing.stockReservations);
      throw createError;
    }

    // Update user profile
    let userResponse = null;
    if (req.user?.sub && authenticatedUser && storage.user?.updateProfile) {
      try {
        const nameParts = customerName.split(/\s+/);
        const user = await storage.user.updateProfile(req.user.sub, {
          phone: meta.customerPhone || undefined,
          billingProfile: {
            firstName: nameParts[0] || "",
            lastName: nameParts.slice(1).join(" ") || "",
            ...billingAddress,
          },
          loyaltyPoints: loyaltyBalanceAfter,
        });
        if (user) userResponse = summarizeUser(user);
      } catch (profileError) {
        console.warn("Order created but failed to update billing profile:", profileError?.message);
      }
    }

    // Audit log
    try {
      await storage.audit.add({
        actorId: req.user?.sub || null,
        action: "add",
        entityType: "order",
        entityId: order.id,
        summary: `Created order ${order.reference} via Paystack (ref: ${reference})`,
      });
    } catch (_e) {}

    // Tracking
    try {
      await storage.tracking.add({
        userId: req.user?.sub || null,
        sessionId: meta.sessionId || null,
        eventType: "purchase",
        eventData: {
          reference: order.reference,
          paystackReference: reference,
          total: order.total,
          paymentMethod: "paystack",
          items: order.items.map((item) => ({ productId: item.productId, qty: item.qty })),
        },
        ipAddress: req.ip || null,
        userAgent: req.get("User-Agent") || null,
      });
    } catch (_e) {}

    return res.status(201).json({
      order,
      user: userResponse,
      loyaltyEarned: pricing.earnedPoints,
      loyalty: userResponse?.loyalty || loyaltyAfterProfile || null,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Payment verification failed" });
  }
}

async function reserveStock(reservations) {
  const applied = [];
  try {
    for (const r of reservations) {
      const nextStock = Math.max(0, Number(r.stockQty || 0) - Number(r.qty || 0));
      await storage.product.update(r.productId, { stockQty: nextStock });
      applied.push(r);
    }
  } catch (error) {
    for (const r of applied) {
      await storage.product.update(r.productId, { stockQty: Math.max(0, Number(r.stockQty || 0)) });
    }
    throw error;
  }
}

async function restoreStock(reservations) {
  for (const r of reservations) {
    await storage.product.update(r.productId, { stockQty: Math.max(0, Number(r.stockQty || 0)) });
  }
}

module.exports = { config, initialize, verify };
