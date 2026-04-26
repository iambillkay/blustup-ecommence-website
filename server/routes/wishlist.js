const express = require("express");

const wishlistController = require("../controllers/wishlistController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, wishlistController.getWishlist);
router.post("/:productId", requireAuth, wishlistController.addToWishlist);
router.delete("/:productId", requireAuth, wishlistController.removeFromWishlist);

module.exports = router;
