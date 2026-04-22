const storage = require("../storage");
const { isMailConfigured, sendMail } = require("./mailService");
const {
  DEFAULT_DELIVERY_SETTINGS,
  normalizeDeliverySettings,
} = require("../utils/cmsDefaults");

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function formatMoney(value) {
  return `GHS ${roundMoney(value).toFixed(2)}`;
}

function formatPaymentMethod(value) {
  const labels = {
    card: "Card",
    cod: "Pay on delivery",
    paypal: "PayPal",
    apple: "Apple Pay",
    google: "Google Pay",
  };
  const key = String(value || "").trim().toLowerCase();
  return labels[key] || key || "Unknown";
}

function makeDispatchId() {
  return `dispatch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function buildAddressBlock(order = {}) {
  const billing = order.billingAddress || {};
  return [
    billing.street,
    [billing.city, billing.state].filter(Boolean).join(", "),
    [billing.zip, billing.country].filter(Boolean).join(" "),
  ].filter(Boolean).join("\n");
}

function buildItemLines(order = {}) {
  return (Array.isArray(order.items) ? order.items : [])
    .map((item) => `- ${item.name} x${Number(item.qty || 0)} (${formatMoney(Number(item.price || 0) * Number(item.qty || 0))})`)
    .join("\n");
}

async function getDeliverySettings() {
  const stored = storage.cms?.getDelivery ? await storage.cms.getDelivery() : DEFAULT_DELIVERY_SETTINGS;
  return normalizeDeliverySettings(stored || DEFAULT_DELIVERY_SETTINGS);
}

async function saveDeliverySettings(nextSettings) {
  const normalized = normalizeDeliverySettings(nextSettings || DEFAULT_DELIVERY_SETTINGS);
  if (!storage.cms?.setDelivery) return normalized;
  return storage.cms.setDelivery(normalized);
}

function selectNextRider(settings) {
  const riders = (settings?.riders || []).filter((rider) => rider && rider.isActive !== false && (rider.email || rider.phone));
  if (!riders.length) return { rider: null, nextRoundRobinIndex: settings?.roundRobinIndex || 0 };

  const currentIndex = Math.max(0, Math.floor(Number(settings?.roundRobinIndex || 0)));
  const rider = riders[currentIndex % riders.length];
  return {
    rider,
    nextRoundRobinIndex: currentIndex + 1,
  };
}

function buildDispatchSubject(settings, order) {
  const prefix = String(settings?.emailSubjectPrefix || DEFAULT_DELIVERY_SETTINGS.emailSubjectPrefix).trim();
  return `${prefix}: ${order.reference}`;
}

function buildDispatchBody(settings, order, rider) {
  const intro = String(settings?.dispatchIntro || DEFAULT_DELIVERY_SETTINGS.dispatchIntro).trim();
  const addressBlock = buildAddressBlock(order);
  const itemLines = buildItemLines(order);
  const customerName = order.customerName || "Customer";
  const paymentMethod = formatPaymentMethod(order.paymentMethod);
  const riderName = rider?.name || "Rider";
  const text = [
    `Hello ${riderName},`,
    "",
    intro,
    "",
    `Order reference: ${order.reference}`,
    `Customer: ${customerName}`,
    `Phone: ${order.customerPhone || "Not provided"}`,
    `Email: ${order.customerEmail || "Not provided"}`,
    `Payment method: ${paymentMethod}`,
    `Order total: ${formatMoney(order.total)}`,
    "",
    "Delivery address:",
    addressBlock || "Address not provided",
    "",
    "Items:",
    itemLines || "- No items listed",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;color:#172033;">
      <p>Hello ${riderName},</p>
      <p>${intro}</p>
      <p><strong>Order reference:</strong> ${order.reference}<br>
      <strong>Customer:</strong> ${customerName}<br>
      <strong>Phone:</strong> ${order.customerPhone || "Not provided"}<br>
      <strong>Email:</strong> ${order.customerEmail || "Not provided"}<br>
      <strong>Payment method:</strong> ${paymentMethod}<br>
      <strong>Order total:</strong> ${formatMoney(order.total)}</p>
      <p><strong>Delivery address</strong><br>${(addressBlock || "Address not provided").replace(/\n/g, "<br>")}</p>
      <p><strong>Items</strong><br>${(itemLines || "- No items listed").replace(/\n/g, "<br>")}</p>
    </div>
  `;

  return { text, html };
}

function buildAssignmentStatus({ automationEnabled, force, rider, mailConfigured, sent, riderHasEmail, sendFailed }) {
  if (!automationEnabled && !force) return "automation_disabled";
  if (!rider) return "no_active_riders";
  if (!riderHasEmail) return "missing_rider_email";
  if (!mailConfigured) return "mail_not_configured";
  if (sendFailed) return "email_failed";
  if (sent) return "rider_notified";
  return "assigned";
}

function buildAssignmentNote(status, rider) {
  const label = rider?.name || rider?.email || rider?.phone || "the rider";
  if (status === "automation_disabled") return "Delivery automation is disabled.";
  if (status === "no_active_riders") return "No active rider is configured yet.";
  if (status === "missing_rider_email") return `${label} was assigned, but no rider email is configured yet.`;
  if (status === "mail_not_configured") return `${label} was assigned, but SMTP is not configured yet.`;
  if (status === "email_failed") return `The delivery brief could not be emailed to ${label}.`;
  if (status === "rider_notified") return `Delivery brief emailed to ${label}.`;
  return `${label} was assigned to the shipment.`;
}

async function dispatchOrderToRider(order, options = {}) {
  if (!order?.id) {
    throw new Error("Order is required for delivery dispatch.");
  }

  const settings = await getDeliverySettings();
  const force = options.force === true;
  const automationRequested = settings.automationEnabled || force;
  const { rider, nextRoundRobinIndex } = automationRequested
    ? selectNextRider(settings)
    : { rider: null, nextRoundRobinIndex: settings.roundRobinIndex };
  const now = new Date().toISOString();
  const mailConfigured = isMailConfigured();
  const riderHasEmail = Boolean(rider?.email);
  let sent = false;
  let sendFailed = false;

  if (automationRequested && rider && riderHasEmail && mailConfigured) {
    const body = buildDispatchBody(settings, order, rider);
    try {
      await sendMail({
        to: rider.email,
        subject: buildDispatchSubject(settings, order),
        text: body.text,
        html: body.html,
      });
      sent = true;
    } catch (_error) {
      sendFailed = true;
    }
  }

  const status = buildAssignmentStatus({
    automationEnabled: settings.automationEnabled,
    force,
    rider,
    mailConfigured,
    sent,
    riderHasEmail,
    sendFailed,
  });
  const note = buildAssignmentNote(status, rider);

  const assignment = {
    id: makeDispatchId(),
    riderId: rider?.id || null,
    riderName: rider?.name || null,
    riderEmail: rider?.email || null,
    riderPhone: rider?.phone || null,
    coverage: rider?.coverage || null,
    status,
    note,
    source: String(options.source || "system"),
    assignedAt: now,
    notifiedAt: sent ? now : null,
  };

  const historyEntry = {
    id: assignment.id,
    orderId: order.id,
    orderReference: order.reference,
    riderId: assignment.riderId || "",
    riderName: assignment.riderName || "",
    riderEmail: assignment.riderEmail || "",
    riderPhone: assignment.riderPhone || "",
    coverage: assignment.coverage || "",
    status: assignment.status,
    source: assignment.source || "system",
    note: assignment.note,
    createdAt: now,
  };

  const nextSettings = normalizeDeliverySettings({
    ...settings,
    roundRobinIndex: automationRequested && rider ? nextRoundRobinIndex : settings.roundRobinIndex,
    history: [historyEntry, ...(Array.isArray(settings.history) ? settings.history : [])],
  });

  await saveDeliverySettings(nextSettings);

  if (storage.order?.updateDeliveryAssignment) {
    await storage.order.updateDeliveryAssignment(order.id, assignment);
  }

  return {
    assignment,
    settings: nextSettings,
    mailConfigured,
  };
}

async function getDeliveryDashboardPayload() {
  const settings = await getDeliverySettings();
  const activeRiders = (settings.riders || []).filter((rider) => rider.isActive !== false);
  return {
    settings,
    history: Array.isArray(settings.history) ? settings.history : [],
    activeRiders: activeRiders.length,
    mailConfigured: isMailConfigured(),
  };
}

module.exports = {
  getDeliverySettings,
  saveDeliverySettings,
  dispatchOrderToRider,
  getDeliveryDashboardPayload,
};
