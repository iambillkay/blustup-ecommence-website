const express = require("express");

const authController = require("../controllers/authController");
const adminController = require("../controllers/adminController");
const orderController = require("../controllers/orderController");
const { requireAuth, requireRole } = require("../middleware/auth");
const { loginLimiter } = require("../middleware/rateLimit");

const router = express.Router();

// Required by your prompt
router.post("/login", loginLimiter, authController.adminLogin);

// Required by your current admin.html (recent actions panel)
router.get("/actions/recent", requireAuth, requireRole("admin"), adminController.recentActions);
router.get("/orders", requireAuth, requireRole("admin"), orderController.listAdminOrders);
router.patch("/orders/:id/status", requireAuth, requireRole("admin"), orderController.updateOrderStatus);
router.post("/orders/:id/dispatch", requireAuth, requireRole("admin"), orderController.dispatchOrderManually);
router.get("/users", requireAuth, requireRole("admin"), orderController.listAdminUsers);
router.get("/analytics/overview", requireAuth, requireRole("admin"), adminController.analyticsOverview);
router.get("/delivery", requireAuth, requireRole("admin"), adminController.deliveryDashboard);
router.patch("/delivery", requireAuth, requireRole("admin"), adminController.updateDeliverySettings);
router.get("/reports", requireAuth, requireRole("admin"), adminController.reportsDashboard);
router.get("/reports/settings", requireAuth, requireRole("admin"), adminController.reportSettings);
router.patch("/reports/settings", requireAuth, requireRole("admin"), adminController.updateReportSettings);
router.post("/reports/run", requireAuth, requireRole("admin"), adminController.runReport);

module.exports = router;
