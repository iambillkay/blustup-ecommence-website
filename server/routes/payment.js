const express = require("express");

const paymentController = require("../controllers/paymentController");
const { attachAuthIfPresent } = require("../middleware/auth");
const { checkoutLimiter } = require("../middleware/rateLimit");

const router = express.Router();

// Client calls this to get a Paystack authorization URL / inline reference
router.post("/initialize", checkoutLimiter, attachAuthIfPresent, paymentController.initialize);

// Client calls this after Paystack Popup reports success
router.get("/verify/:reference", checkoutLimiter, attachAuthIfPresent, paymentController.verify);

// Expose the Paystack public key so the frontend can use Popup inline
router.get("/config", paymentController.config);

module.exports = router;
