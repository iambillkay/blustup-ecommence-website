// ─────────────────────────────────────
// products.js — Product catalogue data (loaded from backend)
// ─────────────────────────────────────

// Global `products` used by shop/cart scripts.
let products = [];

async function loadProducts() {
  try {
    const res = await fetch("/api/products");
    const data = await res.json();
    products = Array.isArray(data.products) ? data.products : [];
    return products;
  } catch (e) {
    console.warn("Failed to load products from API", e);
    products = [];
    return products;
  }
}
