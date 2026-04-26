const storage = require("../storage");

async function getWishlist(req, res) {
  try {
    const items = await storage.user.getWishlist(req.user.sub);
    return res.json({ wishlist: items });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load wishlist" });
  }
}

async function addToWishlist(req, res) {
  const productId = String(req.params.productId || "").trim();
  if (!productId || !storage.isValidId(productId)) {
    return res.status(400).json({ error: "Invalid product ID" });
  }

  try {
    const items = await storage.user.addToWishlist(req.user.sub, productId);
    return res.json({ wishlist: items });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to add to wishlist" });
  }
}

async function removeFromWishlist(req, res) {
  const productId = String(req.params.productId || "").trim();
  if (!productId || !storage.isValidId(productId)) {
    return res.status(400).json({ error: "Invalid product ID" });
  }

  try {
    const items = await storage.user.removeFromWishlist(req.user.sub, productId);
    return res.json({ wishlist: items });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to remove from wishlist" });
  }
}

module.exports = { getWishlist, addToWishlist, removeFromWishlist };
