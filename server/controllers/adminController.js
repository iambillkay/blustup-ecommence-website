const storage = require("../storage");
const { z } = require("zod");
const cron = require("node-cron");
const { getAnalyticsOverview } = require("../services/analyticsService");
const {
  getReportsDashboardPayload,
  getReportSettings,
  saveReportSettings,
  generateAndStoreReport,
} = require("../services/reportingService");
const {
  refreshReportScheduler,
  getReportSchedulerStatus,
} = require("../services/reportScheduler");

const reportSettingsSchema = z.object({
  emailEnabled: z.boolean(),
  emailTo: z.union([z.string().trim().email().max(200), z.literal("")]),
  emailSubjectPrefix: z.string().trim().max(120),
  timezone: z.string().trim().max(80),
  dailyCron: z.string().trim().min(1).max(60),
  weeklyCron: z.string().trim().min(1).max(60),
  inventoryCron: z.string().trim().min(1).max(60),
});

const runReportSchema = z.object({
  type: z.enum(["daily", "weekly", "inventory"]),
});

async function recentActions(req, res) {
  const limit = Math.min(Number(req.query.limit || 20), 100);
  return res.json(await storage.audit.listRecent({ limit }));
}

async function analyticsOverview(_req, res) {
  return res.json(await getAnalyticsOverview());
}

async function reportsDashboard(_req, res) {
  return res.json({
    ...(await getReportsDashboardPayload()),
    scheduler: getReportSchedulerStatus(),
  });
}

async function reportSettings(_req, res) {
  return res.json({ settings: await getReportSettings() });
}

async function updateReportSettings(req, res) {
  const parsed = reportSettingsSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid report settings" });
  }

  const current = await getReportSettings();
  if (!cron.validate(parsed.data.dailyCron)) {
    return res.status(400).json({ error: "Daily cron expression is invalid." });
  }
  if (!cron.validate(parsed.data.weeklyCron)) {
    return res.status(400).json({ error: "Weekly cron expression is invalid." });
  }
  if (!cron.validate(parsed.data.inventoryCron)) {
    return res.status(400).json({ error: "Inventory cron expression is invalid." });
  }
  const settings = await saveReportSettings({
    ...current,
    ...parsed.data,
  });
  await refreshReportScheduler();
  await storage.audit.add({
    actorId: req.user?.sub || null,
    action: "change",
    entityType: "reports",
    entityId: null,
    summary: "Updated scheduled report settings",
  });
  return res.json({ settings });
}

async function runReport(req, res) {
  const parsed = runReportSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid report type" });
  }

  const payload = await generateAndStoreReport(parsed.data.type, {
    source: req.user?.email || "admin_manual",
  });

  await storage.audit.add({
    actorId: req.user?.sub || null,
    action: "add",
    entityType: "reports",
    entityId: payload.report.id,
    summary: `Generated ${parsed.data.type} report`,
  });

  return res.status(201).json(payload);
}

module.exports = {
  recentActions,
  analyticsOverview,
  reportsDashboard,
  reportSettings,
  updateReportSettings,
  runReport,
};
