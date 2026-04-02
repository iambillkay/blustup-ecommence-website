const express = require("express");

const productController = require("../controllers/productController");
const { requireAuth, requireRole, attachAuthIfPresent } = require("../middleware/auth");
const { upload } = require("../middleware/upload");

const router = express.Router();
const adminRequired = requireRole("admin");

// Admin HTML compatibility
router.get("/admin", requireAuth, adminRequired, productController.listAdmin);
router.post("/admin", requireAuth, adminRequired, upload.single("image"), productController.createProduct);
router.patch("/admin/:id", requireAuth, adminRequired, upload.single("image"), productController.updateProduct);
router.delete("/admin/:id", requireAuth, adminRequired, productController.deleteProduct);

// Prompt-required public endpoint
router.get("/", productController.listPublic);
router.post("/:id/reviews", attachAuthIfPresent, productController.addReview);

// Prompt-required admin endpoints (role-protected)
router.post("/", requireAuth, adminRequired, upload.single("image"), productController.createProduct);
router.put("/:id", requireAuth, adminRequired, upload.single("image"), productController.updateProduct);
// Some clients might prefer PATCH too.
router.patch("/:id", requireAuth, adminRequired, upload.single("image"), productController.updateProduct);
router.delete("/:id", requireAuth, adminRequired, productController.deleteProduct);

module.exports = router;
