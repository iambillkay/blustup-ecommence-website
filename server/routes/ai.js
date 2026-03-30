const express = require("express");
const aiController = require("../controllers/aiController");
const { requireAuth, requireRole } = require("../middleware/auth");
const { loginLimiter } = require("../middleware/rateLimit");

const router = express.Router();
const adminOnly = [requireAuth, requireRole("admin")];

router.post("/chat", loginLimiter, aiController.chat);
router.post("/search", loginLimiter, aiController.search);
router.post("/product-description", loginLimiter, ...adminOnly, aiController.suggestProductDescription);

module.exports = router;
