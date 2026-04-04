const storage = require("../storage");
const { getAnalyticsOverview } = require("./analyticsService");
const { isMailConfigured, sendMail } = require("./mailService");
const {
  DEFAULT_REPORT_SETTINGS,
  normalizeReportSettings,
} = require("../utils/cmsDefaults");

function escHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function formatMoney(value) {
  return `GHS ${roundMoney(value).toFixed(2)}`;
}

async function getReportSettings() {
  const stored = storage.cms?.getReports ? await storage.cms.getReports() : DEFAULT_REPORT_SETTINGS;
  return normalizeReportSettings(stored || DEFAULT_REPORT_SETTINGS);
}

async function saveReportSettings(nextSettings) {
  const normalized = normalizeReportSettings(nextSettings || DEFAULT_REPORT_SETTINGS);
  if (!storage.cms?.setReports) return normalized;
  return storage.cms.setReports(normalized);
}

function buildReportSummary(type, overview) {
  if (type === "daily") {
    return `Daily sales: ${formatMoney(overview.sales.todayRevenue)} from ${overview.sales.todayOrders} orders today.`;
  }
  if (type === "weekly") {
    return `Weekly sales: ${formatMoney(overview.sales.weekRevenue)} from ${overview.sales.weekOrders} orders in the last 7 days.`;
  }
  return `Inventory watch: ${overview.inventory.lowStockCount} low-stock items and ${overview.inventory.slowMoving.length} slow-moving products flagged.`;
}

function buildReportSnapshot(type, overview) {
  if (type === "daily") {
    return {
      period: "today",
      revenue: overview.sales.todayRevenue,
      orders: overview.sales.todayOrders,
      revenueChangePercent: overview.sales.dailyRevenueChangePercent,
      averageOrderValue: overview.sales.averageOrderValue,
    };
  }
  if (type === "weekly") {
    return {
      period: "last_7_days",
      revenue: overview.sales.weekRevenue,
      orders: overview.sales.weekOrders,
      revenueChangePercent: overview.sales.weeklyRevenueChangePercent,
      topProducts: overview.revenue.topProducts,
      funnel: overview.funnel,
    };
  }
  return {
    period: "inventory_watch",
    lowStockCount: overview.inventory.lowStockCount,
    slowMoving: overview.inventory.slowMoving,
  };
}

function buildEmailSubject(type, settings) {
  const prefix = String(settings.emailSubjectPrefix || "Blustup Reports").trim();
  const label = type === "daily" ? "Daily Sales Report" : type === "weekly" ? "Weekly Sales Report" : "Inventory Turnover Report";
  return `${prefix}: ${label}`;
}

function buildEmailBody(type, overview) {
  const summary = buildReportSummary(type, overview);
  const bulletLines = [];

  if (type === "daily") {
    bulletLines.push(`Today's revenue: ${formatMoney(overview.sales.todayRevenue)}`);
    bulletLines.push(`Today's orders: ${overview.sales.todayOrders}`);
    bulletLines.push(`Daily change: ${overview.sales.dailyRevenueChangePercent}% vs yesterday`);
    bulletLines.push(`Average order value: ${formatMoney(overview.sales.averageOrderValue)}`);
  } else if (type === "weekly") {
    bulletLines.push(`7-day revenue: ${formatMoney(overview.sales.weekRevenue)}`);
    bulletLines.push(`7-day orders: ${overview.sales.weekOrders}`);
    bulletLines.push(`Weekly change: ${overview.sales.weeklyRevenueChangePercent}% vs previous week`);
    bulletLines.push(`View to purchase: ${overview.funnel.viewToPurchasePercent}%`);
  } else {
    bulletLines.push(`Low stock products: ${overview.inventory.lowStockCount}`);
    bulletLines.push(`Slow-moving products flagged: ${overview.inventory.slowMoving.length}`);
    overview.inventory.slowMoving.slice(0, 5).forEach((item) => {
      bulletLines.push(`${item.name}: ${item.unitsSold30d} sold in 30 days, ${item.stockQty} in stock`);
    });
  }

  const text = `${summary}\n\n${bulletLines.map((line) => `- ${line}`).join("\n")}`;
  const html = `
    <div style="font-family:Arial,sans-serif;color:#172033;">
      <h2 style="margin:0 0 12px;">${escHtml(summary)}</h2>
      <ul style="padding-left:18px;margin:0;">
        ${bulletLines.map((line) => `<li style="margin:0 0 8px;">${escHtml(line)}</li>`).join("")}
      </ul>
    </div>`;

  return { text, html };
}

async function generateAndStoreReport(type, options = {}) {
  const normalizedType = ["daily", "weekly", "inventory"].includes(String(type || "").trim().toLowerCase())
    ? String(type || "").trim().toLowerCase()
    : "daily";
  const settings = await getReportSettings();
  const overview = await getAnalyticsOverview();
  const generatedAt = new Date().toISOString();
  const summary = buildReportSummary(normalizedType, overview);
  const snapshot = buildReportSnapshot(normalizedType, overview);
  const emailTo = settings.emailTo || process.env.REPORT_EMAIL_TO || process.env.ADMIN_EMAIL || "";

  let emailStatus = settings.emailEnabled ? "queued" : "disabled";
  if (settings.emailEnabled) {
    if (!emailTo) {
      emailStatus = "missing_recipient";
    } else if (isMailConfigured()) {
      const body = buildEmailBody(normalizedType, overview);
      try {
        await sendMail({
          to: emailTo,
          subject: buildEmailSubject(normalizedType, settings),
          text: body.text,
          html: body.html,
        });
        emailStatus = "sent";
      } catch (error) {
        emailStatus = "failed";
      }
    } else {
      emailStatus = "mail_not_configured";
    }
  }

  const report = {
    id: `report-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: normalizedType,
    generatedAt,
    summary,
    emailStatus,
    emailTo,
    source: String(options.source || "system"),
    snapshot,
  };

  const nextSettings = normalizeReportSettings({
    ...settings,
    history: [report, ...(Array.isArray(settings.history) ? settings.history : [])],
    lastRunByType: {
      ...(settings.lastRunByType || {}),
      [normalizedType]: generatedAt,
    },
  });

  await saveReportSettings(nextSettings);
  return {
    report,
    settings: nextSettings,
    overview,
  };
}

async function getReportsDashboardPayload() {
  const [settings, overview] = await Promise.all([
    getReportSettings(),
    getAnalyticsOverview(),
  ]);

  return {
    settings,
    history: Array.isArray(settings.history) ? settings.history : [],
    overview,
    mailConfigured: isMailConfigured(),
  };
}

module.exports = {
  getReportSettings,
  saveReportSettings,
  generateAndStoreReport,
  getReportsDashboardPayload,
};
