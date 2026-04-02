const express = require("express");

const orderController = require("../controllers/orderController");
const { attachAuthIfPresent, requireAuth } = require("../middleware/auth");
const { checkoutLimiter } = require("../middleware/rateLimit");

const router = express.Router();

router.post("/", checkoutLimiter, attachAuthIfPresent, orderController.createOrder);
router.get("/me", requireAuth, orderController.listMyOrders);
router.get("/lookup", checkoutLimiter, orderController.lookupOrder);

module.exports = router;
