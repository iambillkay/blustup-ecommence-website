const cron = require("node-cron");
const { getReportSettings, generateAndStoreReport } = require("./reportingService");

const { autoMarkDownSlowMovers } = require("./inventoryAutomationService");

let scheduledTasks = [];
let started = false;
let scheduledDefinitions = [];

function stopScheduledTasks() {
  scheduledTasks.forEach((task) => task.stop());
  scheduledTasks = [];
}

async function scheduleReports() {
  const settings = await getReportSettings();
  stopScheduledTasks();
  scheduledDefinitions = [];

  const definitions = [
    { type: "daily", expression: settings.dailyCron },
    { type: "weekly", expression: settings.weeklyCron },
    { type: "inventory", expression: settings.inventoryCron },
  ];

  definitions.forEach((definition) => {
    if (!cron.validate(definition.expression)) return;
    scheduledDefinitions.push({
      type: definition.type,
      expression: definition.expression,
      timezone: settings.timezone || "Africa/Accra",
    });
    const task = cron.schedule(
      definition.expression,
      async () => {
        try {
          await generateAndStoreReport(definition.type, { source: "cron" });
          if (definition.type === "inventory") {
            await autoMarkDownSlowMovers().catch(err => console.error("Slow-mover automation failed:", err));
          }
        } catch (error) {
          console.error(`Failed to run ${definition.type} report:`, error?.message || error);
        }
      },
      {
        timezone: settings.timezone || "Africa/Accra",
      }
    );
    scheduledTasks.push(task);
  });
}

async function startReportScheduler() {
  if (started) return;
  await scheduleReports();
  started = true;
}

async function refreshReportScheduler() {
  await scheduleReports();
}

function getReportSchedulerStatus() {
  return {
    started,
    activeTaskCount: scheduledTasks.length,
    schedules: [...scheduledDefinitions],
  };
}

module.exports = {
  startReportScheduler,
  refreshReportScheduler,
  getReportSchedulerStatus,
};
