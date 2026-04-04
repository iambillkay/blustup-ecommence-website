const express = require("express");
const cmsController = require("../controllers/cmsController");
const { requireAuth, requireRole } = require("../middleware/auth");
const { upload } = require("../middleware/upload");

const router = express.Router();
const adminOnly = [requireAuth, requireRole("admin")];

router.get("/home", cmsController.getHome);
router.put("/home", ...adminOnly, cmsController.setHome);
router.post("/home/upload-image", ...adminOnly, upload.single("image"), cmsController.uploadHomeImage);

router.get("/shop", cmsController.getShop);
router.put("/shop", ...adminOnly, cmsController.setShop);

router.get("/ai", cmsController.getAi);
router.put("/ai", ...adminOnly, cmsController.setAi);

router.get("/deals", cmsController.getDeals);
router.put("/deals", ...adminOnly, cmsController.setDeals);

router.get("/faq", cmsController.getFaq);
router.put("/faq", ...adminOnly, cmsController.setFaq);
router.get("/about", cmsController.getAbout);
router.put("/about", ...adminOnly, cmsController.setAbout);
router.post("/upload-image", ...adminOnly, upload.single("image"), cmsController.uploadCmsImage);

module.exports = router;
