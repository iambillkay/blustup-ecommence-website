const storage = require("../storage");

async function recentActions(req, res) {
  const limit = Math.min(Number(req.query.limit || 20), 100);
  return res.json(await storage.audit.listRecent({ limit }));
}

module.exports = { recentActions };

