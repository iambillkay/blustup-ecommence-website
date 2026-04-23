const rateLimit = require("express-rate-limit");

function createLimiter(windowMs, max) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
  });
}

const loginLimiter = createLimiter(15 * 60 * 1000, 10);
const checkoutLimiter = createLimiter(15 * 60 * 1000, 30);
const trackingLimiter = createLimiter(15 * 60 * 1000, 120);

module.exports = { loginLimiter, checkoutLimiter, trackingLimiter };
