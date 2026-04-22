// ─────────────────────────────────────
// products.js — Product catalogue data (loaded from backend)
// ─────────────────────────────────────

// Global `products` used by shop/cart scripts.
let products = [];
let allProducts = [];
let productsLoadPromise = null;
let productsLoadError = null;

const PRODUCTS_PAGE_SIZE = 50;

async function fetchProductsPage(pageNumber) {
  const params = new URLSearchParams({
    page: String(pageNumber),
    limit: String(PRODUCTS_PAGE_SIZE),
  });
  const res = await apiFetch(`/api/products?${params.toString()}`, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Failed to load products");
  return data;
}

async function fetchAllProducts() {
  let page = 1;
  let totalPages = 1;
  const nextProducts = [];

  while (page <= totalPages) {
    const data = await fetchProductsPage(page);
    const rows = Array.isArray(data?.products) ? data.products : [];
    nextProducts.push(...rows);

    const reportedTotalPages = Number(data?.pagination?.totalPages || 1);
    totalPages = Number.isFinite(reportedTotalPages) && reportedTotalPages > 0 ? reportedTotalPages : 1;
    page += 1;
  }

  return nextProducts;
}

async function loadProducts(options = {}) {
  const force = options?.force === true;

  if (!force && allProducts.length) return allProducts;
  if (productsLoadPromise) return productsLoadPromise;

  const previousProducts = Array.isArray(products) ? [...products] : [];
  const previousAllProducts = Array.isArray(allProducts) ? [...allProducts] : [];

  productsLoadPromise = (async () => {
    try {
      const nextProducts = await fetchAllProducts();
      productsLoadError = null;
      products = nextProducts;
      allProducts = [...nextProducts];
      if (typeof window.reconcileCartWithProducts === "function") {
        window.reconcileCartWithProducts();
      }
      return products;
    } catch (e) {
      console.warn("Failed to load products from API", e);
      productsLoadError = e?.message || "Unable to load products";
      products = previousProducts;
      allProducts = previousAllProducts;
      return allProducts;
    } finally {
      productsLoadPromise = null;
    }
  })();

  return productsLoadPromise;
}

function setProductsFromSearch(nextProducts) {
  products = Array.isArray(nextProducts) ? nextProducts : [];
}

function resetProductsFromSearch() {
  products = [...allProducts];
}

window.loadProducts = loadProducts;
window.getProductsLoadError = () => productsLoadError;
