const express = require("express");
const router = express.Router();
const trackingController = require("../controllers/trackingController");
const { attachAuthIfPresent } = require("../middleware/auth");
const { trackingLimiter } = require("../middleware/rateLimit");

router.post("/event", trackingLimiter, attachAuthIfPresent, trackingController.trackEvent);

module.exports = router;
