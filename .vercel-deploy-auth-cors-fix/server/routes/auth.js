const express = require("express");

const authController = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");
const { loginLimiter } = require("../middleware/rateLimit");

const router = express.Router();

router.post("/signup", loginLimiter, authController.signup);
router.post("/login", loginLimiter, authController.login);

router.get("/login", loginLimiter, (_req, res) => res.status(405).json({ error: "Use POST /api/auth/login" }));

router.get("/me", requireAuth, authController.me);

module.exports = router;
