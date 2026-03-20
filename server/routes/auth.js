const express = require("express");

const authController = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");
const { loginLimiter } = require("../middleware/rateLimit");

const router = express.Router();

router.post("/signup", loginLimiter, authController.signup);
router.post("/login", loginLimiter, authController.login);

// Helpful fallback: some frontends/tools may accidentally call GET.
// We return a clear error (and optionally allow query-based login).
router.get("/login", loginLimiter, async (req, res) => {
  const email = req.query?.email;
  const password = req.query?.password;

  if (!email || !password) {
    return res.status(405).json({ error: "Use POST /api/auth/login" });
  }

  // Reuse the same controller logic by treating query params as the body.
  req.body = { email, password };
  return authController.login(req, res);
});

router.get("/me", requireAuth, authController.me);

module.exports = router;

