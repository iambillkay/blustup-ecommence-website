const { z } = require("zod");

const storage = require("../storage");
const { buildLoyaltyProfile, calculateEarnedLoyaltyPoints } = require("../utils/storefront");
const { dispatchOrderToRider } = require("../services/deliveryDispatchService");

const ORDER_STATUSES = ["placed", "processing", "shipped", "delivered", "cancelled"];
const TAX_RATE = 0.08;
const FREE_SHIPPING_THRESHOLD = 50;
const SHIPPING_FLAT_RATE = 5.99;
const KNOWN_PROMOS = {
  AIRLUME20: { percent: 0.2, label: "20% off (AIRLUME20)" },
  BLUSTUP10: { percent: 0.1, label: "10% off (BLUSTUP10)" },
  FREESHIP: { percent: 0, label: "Free shipping (FREESHIP)", freeShip: true },
};
const DEFAULT_STATUS_NOTES = {
  placed: "Order received and queued for confirmation.",
  processing: "Your items are being prepared for dispatch.",
  shipped: "Your order is on the way.",
  delivered: "Your order has been delivered successfully.",
  cancelled: "This order has been cancelled.",
};

const addressSchema = z.object({
  street: z.string().trim().min(1).max(160),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(1).max(80),
  zip: z.string().trim().min(1).max(20),
  country: z.string().trim().min(1).max(80),
});

const createOrderSchema = z.object({
  sessionId: z.string().trim().max(120).optional().nullable(),
  paymentMethod: z.enum(["card", "cod", "paypal", "apple", "google", "paystack"]),
  promoCode: z.union([z.string().trim().max(40), z.literal(""), z.null()]).optional(),
  customer: z.object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(200).transform((value) => value.toLowerCase()),
    phone: z.string().trim().min(8).max(20),
  }),
  billingAddress: addressSchema,
  items: z.array(
    z.object({
      productId: z.string().trim().min(1).max(80),
      qty: z.number().int().min(1).max(99),
    })
  ).min(1).max(50),
});

const lookupSchema = z.object({
  reference: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200).transform((value) => value.toLowerCase()),
});

const updateStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.union([z.string().trim().max(240), z.literal(""), z.null()]).optional(),
});

function makeReference() {
  const stamp = Date.now().toString(36).toUpperCase();
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `BLU-${stamp}-${randomPart}`;
}

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

function buildCustomerName(customer) {
  return `${customer.firstName} ${customer.lastName}`.trim();
}

function buildBillingProfile(customer, billingAddress) {
  return {
    firstName: customer.firstName,
    lastName: customer.lastName,
    street: billingAddress.street,
    city: billingAddress.city,
    state: billingAddress.state,
    zip: billingAddress.zip,
    country: billingAddress.country,
  };
}

function buildOrderStatusNote(status, note) {
  const providedNote = String(note || "").trim();
  if (providedNote) return providedNote;
  return DEFAULT_STATUS_NOTES[String(status || "").trim().toLowerCase()] || "Order status updated.";
}

function summarizeUser(user) {
  if (typeof storage.getAuthUserResponse === "function") {
    return storage.getAuthUserResponse(user);
  }
  return { id: user._id.toString(), name: user.name, email: user.email, role: user.role };
}

function groupRequestedItems(items) {
  const grouped = new Map();
  for (const item of items) {
    const key = String(item.productId).trim();
    const qty = Math.max(1, Number(item.qty || 1));
    grouped.set(key, (grouped.get(key) || 0) + qty);
  }
  return grouped;
}

async function buildOrderFromCatalog(parsedOrder, options = {}) {
  const { products } = await storage.product.listAdmin();
  const activeProducts = new Map(
    (Array.isArray(products) ? products : [])
      .filter((product) => product && product.isActive !== false)
      .map((product) => [String(product.id), product])
  );
  const loyalty = buildLoyaltyProfile(options.user?.loyaltyPoints);

  const grouped = groupRequestedItems(parsedOrder.items);
  const orderItems = [];

  for (const [productId, qty] of grouped.entries()) {
    const product = activeProducts.get(productId);
    if (!product) {
      throw new Error("One or more products are unavailable.");
    }
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
  const promo = normalizePromo(parsedOrder.promoCode);
  const discount = roundMoney(Math.min(subtotal, subtotal * promo.percent));
  const discountedSubtotal = roundMoney(Math.max(0, subtotal - discount));
  const shipping = roundMoney(
    promo.freeShip || loyalty.freeShippingEligible || discountedSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT_RATE
  );
  const tax = roundMoney((discountedSubtotal + shipping) * TAX_RATE);
  const total = roundMoney(discountedSubtotal + shipping + tax);
  const earnedPoints = options.user ? calculateEarnedLoyaltyPoints(total) : 0;

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

async function reserveStock(reservations) {
  const appliedReservations = [];

  try {
    for (const reservation of reservations) {
      const nextStock = Math.max(0, Number(reservation.stockQty || 0) - Number(reservation.qty || 0));
      await storage.product.update(reservation.productId, { stockQty: nextStock });
      appliedReservations.push(reservation);
    }
  } catch (error) {
    for (const reservation of appliedReservations) {
      await storage.product.update(reservation.productId, {
        stockQty: Math.max(0, Number(reservation.stockQty || 0)),
      });
    }

    throw error;
  }
}

async function restoreStock(reservations) {
  for (const reservation of reservations) {
    await storage.product.update(reservation.productId, {
      stockQty: Math.max(0, Number(reservation.stockQty || 0)),
    });
  }
}

async function createOrder(req, res) {
  const parsed = createOrderSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid checkout details" });
  }

  try {
    const authenticatedUser = req.user?.sub ? await storage.user.findById(req.user.sub) : null;
    const pricing = await buildOrderFromCatalog(parsed.data, { user: authenticatedUser });
    const customerName = buildCustomerName(parsed.data.customer);
    const billingProfile = buildBillingProfile(parsed.data.customer, parsed.data.billingAddress);
    const loyaltyBalanceAfter = authenticatedUser
      ? Math.max(0, Number(authenticatedUser.loyaltyPoints || 0)) + pricing.earnedPoints
      : 0;
    const loyaltyAfterProfile = authenticatedUser ? buildLoyaltyProfile(loyaltyBalanceAfter) : null;

    await reserveStock(pricing.stockReservations);

    let order;

    try {
      order = await storage.order.create({
        reference: makeReference(),
        userId: req.user?.sub || null,
        sessionId: parsed.data.sessionId || null,
        customerName,
        customerEmail: parsed.data.customer.email,
        customerPhone: parsed.data.customer.phone,
        billingAddress: billingProfile,
        items: pricing.items,
        paymentMethod: parsed.data.paymentMethod,
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
      });
    } catch (createError) {
      await restoreStock(pricing.stockReservations);
      throw createError;
    }

    let userResponse = null;
    if (req.user?.sub && authenticatedUser && storage.user?.updateProfile) {
      try {
        const user = await storage.user.updateProfile(req.user.sub, {
          phone: parsed.data.customer.phone,
          billingProfile,
          loyaltyPoints: Math.max(0, Number(authenticatedUser.loyaltyPoints || 0)) + pricing.earnedPoints,
        });
        if (user) userResponse = summarizeUser(user);
      } catch (profileError) {
        console.warn("Order created but failed to update billing profile:", profileError?.message || profileError);
      }
    }

    try {
      await storage.audit.add({
        actorId: req.user?.sub || null,
        action: "add",
        entityType: "order",
        entityId: order.id,
        summary: `Created order ${order.reference} for ${order.customerEmail}`,
      });
    } catch (auditError) {
      console.warn("Order created but failed to write audit log:", auditError?.message || auditError);
    }

    try {
      await storage.tracking.add({
        userId: req.user?.sub || null,
        sessionId: parsed.data.sessionId || null,
        eventType: "purchase",
        eventData: {
          reference: order.reference,
          total: order.total,
          paymentMethod: order.paymentMethod,
          items: order.items.map((item) => ({
            productId: item.productId,
            qty: item.qty,
          })),
        },
        ipAddress: req.ip || req.connection?.remoteAddress || null,
        userAgent: req.get("User-Agent") || null,
      });
    } catch (trackingError) {
      console.warn("Order created but failed to track purchase:", trackingError?.message || trackingError);
    }

    return res.status(201).json({
      order,
      user: userResponse,
      loyaltyEarned: pricing.earnedPoints,
      loyalty: userResponse?.loyalty || loyaltyAfterProfile || null,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to place order" });
  }
}

async function listMyOrders(req, res) {
  const user = await storage.user.findById(req.user.sub);
  if (!user) return res.status(404).json({ error: "Account not found" });

  const result = await storage.order.listForUser({ userId: req.user.sub, email: user.email });
  return res.json(result);
}

async function lookupOrder(req, res) {
  const parsed = lookupSchema.safeParse(req.query || {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid lookup details" });
  }

  const order = await storage.order.lookupByReference({
    ...parsed.data,
    reference: parsed.data.reference.toUpperCase(),
  });
  if (!order) return res.status(404).json({ error: "Order not found" });
  return res.json({ order });
}

async function listAdminOrders(req, res) {
  const limit = Math.min(Math.max(1, Number(req.query.limit || 50)), 100);
  const status = String(req.query.status || "").trim() || undefined;
  const q = String(req.query.q || "").trim() || undefined;
  return res.json(await storage.order.listAdmin({ limit, status, q }));
}

async function updateOrderStatus(req, res) {
  const parsed = updateStatusSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid status update" });
  }

  if (!storage.isValidId(req.params.id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const existingOrder = await storage.order.getById(req.params.id);
  if (!existingOrder) return res.status(404).json({ error: "Order not found" });

  const order = await storage.order.updateStatus(req.params.id, {
    status: parsed.data.status,
    note: buildOrderStatusNote(parsed.data.status, parsed.data.note),
    actorId: req.user?.sub || null,
    actorEmail: req.user?.email || null,
  });

  if (!order) return res.status(404).json({ error: "Order not found" });

  let dispatch = null;
  const previousStatus = String(existingOrder.status || "").trim().toLowerCase();
  const nextStatus = String(order.status || "").trim().toLowerCase();
  if (nextStatus === "shipped" && previousStatus !== "shipped") {
    try {
      dispatch = await dispatchOrderToRider(order, {
        source: "order_status_update",
      });
    } catch (dispatchError) {
      console.warn("Order marked shipped but rider dispatch failed:", dispatchError?.message || dispatchError);
    }
  }

  try {
    await storage.audit.add({
      actorId: req.user?.sub || null,
      action: "change",
      entityType: "order",
      entityId: order.id,
      summary: `Updated order ${order.reference} to ${order.status}`,
    });
  } catch (auditError) {
    console.warn("Order status updated but failed to write audit log:", auditError?.message || auditError);
  }

  if (dispatch?.assignment) {
    try {
      await storage.audit.add({
        actorId: req.user?.sub || null,
        action: "change",
        entityType: "delivery",
        entityId: order.id,
        summary: `Dispatch status for ${order.reference}: ${dispatch.assignment.status}`,
      });
    } catch (auditError) {
      console.warn("Delivery dispatch audit log failed:", auditError?.message || auditError);
    }
  }

  const latestOrder = dispatch?.assignment ? await storage.order.getById(req.params.id) : order;
  return res.json({ order: latestOrder, dispatch: dispatch?.assignment || null });
}

async function dispatchOrderManually(req, res) {
  if (!storage.isValidId(req.params.id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const order = await storage.order.getById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  const status = String(order.status || "").trim().toLowerCase();
  if (status !== "shipped") {
    return res.status(400).json({ error: "Mark the order as shipped before dispatching a rider." });
  }

  const dispatch = await dispatchOrderToRider(order, {
    source: req.user?.email || "admin_manual",
    force: true,
  });

  try {
    await storage.audit.add({
      actorId: req.user?.sub || null,
      action: "change",
      entityType: "delivery",
      entityId: order.id,
      summary: `Manually dispatched rider for ${order.reference}: ${dispatch.assignment.status}`,
    });
  } catch (auditError) {
    console.warn("Manual delivery dispatch audit log failed:", auditError?.message || auditError);
  }

  return res.status(201).json({
    order: await storage.order.getById(req.params.id),
    dispatch: dispatch.assignment,
    mailConfigured: dispatch.mailConfigured,
  });
}

async function listAdminUsers(req, res) {
  const [userResult, orderResult] = await Promise.all([
    storage.user.listAdmin(),
    storage.order.listAdmin({ limit: 1000 }),
  ]);

  const orders = Array.isArray(orderResult?.orders) ? orderResult.orders : [];
  const users = Array.isArray(userResult?.users) ? userResult.users : [];

  const orderStatsByEmail = new Map();
  orders.forEach((order) => {
    const key = String(order.customerEmail || "").trim().toLowerCase();
    if (!key) return;
    const current = orderStatsByEmail.get(key) || {
      orderCount: 0,
      totalSpent: 0,
      latestOrderReference: null,
      latestOrderStatus: null,
      latestOrderAt: null,
    };

    current.orderCount += 1;
    current.totalSpent += Number(order.total || 0);
    if (!current.latestOrderAt || new Date(order.createdAt).getTime() > new Date(current.latestOrderAt).getTime()) {
      current.latestOrderReference = order.reference;
      current.latestOrderStatus = order.status;
      current.latestOrderAt = order.createdAt;
    }

    orderStatsByEmail.set(key, current);
  });

  const userMap = new Map(
    users.map((user) => [String(user.email || "").trim().toLowerCase(), { ...user }])
  );

  orders.forEach((order) => {
    const key = String(order.customerEmail || "").trim().toLowerCase();
    if (!key || userMap.has(key)) return;

    userMap.set(key, {
      id: `guest:${key}`,
      name: order.customerName || "Guest customer",
      email: order.customerEmail,
      phone: order.customerPhone || null,
      loyaltyPoints: 0,
      loyalty: buildLoyaltyProfile(0),
      billingProfile: order.billingAddress || null,
      role: "guest",
      createdAt: order.createdAt,
      updatedAt: order.updatedAt || order.createdAt,
    });
  });

  const combinedUsers = [...userMap.values()];

  return res.json({
    users: combinedUsers
      .map((user) => {
      const stats = orderStatsByEmail.get(String(user.email || "").trim().toLowerCase()) || {
        orderCount: 0,
        totalSpent: 0,
        latestOrderReference: null,
        latestOrderStatus: null,
        latestOrderAt: null,
      };
      return {
        ...user,
        orderCount: stats.orderCount,
        totalSpent: roundMoney(stats.totalSpent),
        latestOrderReference: stats.latestOrderReference,
        latestOrderStatus: stats.latestOrderStatus,
        latestOrderAt: stats.latestOrderAt,
      };
    })
      .sort((a, b) => {
        const aTime = new Date(a.latestOrderAt || a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.latestOrderAt || b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      }),
  });
}

module.exports = {
  createOrder,
  listMyOrders,
  lookupOrder,
  listAdminOrders,
  updateOrderStatus,
  dispatchOrderManually,
  listAdminUsers,
};
