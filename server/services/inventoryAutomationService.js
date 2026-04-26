const storage = require("../storage");
const { getAnalyticsOverview } = require("./analyticsService");

/**
 * Automatically identifies slow-moving inventory and applies markdowns.
 * Slow-moving is defined by analyticsService (typically 0 sales in 30 days).
 */
async function autoMarkDownSlowMovers() {
  console.log("[InventoryAutomation] Starting slow-mover analysis...");
  
  const analytics = await getAnalyticsOverview();
  const slowMovers = analytics.inventory?.slowMoving || [];
  
  if (slowMovers.length === 0) {
    console.log("[InventoryAutomation] No slow-moving items identified.");
    return { count: 0, actions: [] };
  }

  const cms = await storage.cms.getDeals();
  // Find or create a "Clearance" deal
  let clearanceDeal = cms.find(d => d.name.toLowerCase().includes("clearance") || d.id === "clearance-auto");
  
  if (!clearanceDeal) {
    clearanceDeal = {
      id: "clearance-auto",
      name: "🔥 Inventory Clearance",
      timerSeconds: 86400, // 24 hours
      sourceCategories: ["Clearance"],
      maxItems: 12,
      isActive: true,
      productIds: []
    };
    cms.push(clearanceDeal);
  }

  const actions = [];
  const DISCOUNT_RATE = 0.15; // 15% off

  for (const mover of slowMovers) {
    const product = await storage.product.findById(mover.productId);
    if (!product || !product.isActive) continue;

    // Only mark down if it doesn't already have an oldPrice (to avoid double discounting)
    if (product.oldPrice == null || product.oldPrice <= product.price) {
      const originalPrice = product.price;
      const newPrice = Math.floor(originalPrice * (1 - DISCOUNT_RATE));
      
      await storage.product.update(product.id, {
        price: newPrice,
        oldPrice: originalPrice,
        badge: "Clearance",
        badgeType: "sale"
      });

      if (!clearanceDeal.productIds.includes(String(product.id))) {
        clearanceDeal.productIds.push(String(product.id));
      }

      actions.push(`Marked down ${product.name} from ${originalPrice} to ${newPrice}`);
      
      // Audit log
      await storage.audit.add({
        action: "auto_markdown",
        entityType: "product",
        entityId: product.id,
        summary: `Automated 15% markdown for slow-moving item: ${product.name}`
      });
    }
  }

  if (actions.length > 0) {
    await storage.cms.updateDeals(cms);
    console.log(`[InventoryAutomation] Completed: ${actions.length} items processed.`);
  } else {
    console.log("[InventoryAutomation] No new items needed markdowns.");
  }

  return { count: actions.length, actions };
}

module.exports = { autoMarkDownSlowMovers };
