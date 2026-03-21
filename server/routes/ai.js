const express = require("express");
const aiController = require("../controllers/aiController");
const { loginLimiter } = require("../middleware/rateLimit");

const router = express.Router();

router.post("/chat", loginLimiter, aiController.chat);
router.post("/search", loginLimiter, aiController.search);

module.exports = router;

