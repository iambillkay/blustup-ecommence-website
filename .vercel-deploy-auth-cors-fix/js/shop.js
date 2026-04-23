const SHOP_CURRENCY_SYMBOL = typeof CART_CURRENCY_SYMBOL === "string" ? CART_CURRENCY_SYMBOL : "\u20B5";
const shopMoneyFormatter = new Intl.NumberFormat("en-GH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

let currentFilter = "all";
let shopSettings = null;
let shopSkeletonVisible = false;

function renderShopFiltersSkeleton() {
  const wrap = document.querySelector(".shop-filters");
  if (!wrap) return;

  const widths = ["112px", "88px", "128px", "72px", "104px"];
  wrap.innerHTML = widths
    .map((width) => `<span class="shop-skeleton-pill" style="width:${width};" aria-hidden="true"></span>`)
    .join("");
}

function renderProductsSkeleton(count = 8) {
  const grid = document.getElementById("products-grid");
  if (!grid) return;

  grid.innerHTML = Array.from({ length: count }, () => `
    <article class="product-card product-card-skeleton" aria-hidden="true">
      <div class="product-img product-img-skeleton">
        <span class="shop-skeleton shop-skeleton-badge"></span>
      </div>
      <div class="product-info">
        <div class="product-category-list">
          <span class="shop-skeleton shop-skeleton-chip"></span>
          <span class="shop-skeleton shop-skeleton-chip short"></span>
        </div>
        <div class="shop-skeleton shop-skeleton-title"></div>
        <div class="shop-skeleton shop-skeleton-title short"></div>
        <div class="product-footer">
          <div class="shop-skeleton shop-skeleton-price"></div>
          <div class="shop-skeleton shop-skeleton-button"></div>
        </div>
      </div>
    </article>
  `).join("");
}

function setShopHeroLoadingState(isLoading) {
  const hero = document.querySelector(".shop-hero");
  if (!hero) return;

  hero.classList.toggle("is-loading", isLoading);
  hero.setAttribute("aria-busy", isLoading ? "true" : "false");

  const title = hero.querySelector("h1");
  const subtitle = hero.querySelector("p");

  if (title) {
    if (isLoading) title.innerHTML = '<span class="shop-skeleton shop-skeleton-hero-title" aria-hidden="true"></span>';
    else if (!title.textContent.trim()) title.textContent = "Shop";
  }

  if (subtitle) {
    if (isLoading) {
      subtitle.innerHTML = '<span class="shop-skeleton shop-skeleton-hero-copy" aria-hidden="true"></span>';
      if (!hero.querySelector(".shop-skeleton-hero-action")) {
        const actionPlaceholder = document.createElement("div");
        actionPlaceholder.className = "shop-skeleton shop-skeleton-hero-action";
        actionPlaceholder.setAttribute("aria-hidden", "true");
        subtitle.insertAdjacentElement("afterend", actionPlaceholder);
      }
    } else {
      if (!subtitle.textContent.trim()) subtitle.textContent = "Discover products tailored to your needs";
      const actionPlaceholder = hero.querySelector(".shop-skeleton-hero-action");
      if (actionPlaceholder) actionPlaceholder.remove();
    }
  }
}

function setShopLoadingState(isLoading, options = {}) {
  const shouldSkeletonizeProducts = options?.products !== false;
  const shouldSkeletonizeFilters = options?.filters !== false;

  shopSkeletonVisible = isLoading;

  if (isLoading) {
    setShopHeroLoadingState(true);
    if (shouldSkeletonizeFilters) renderShopFiltersSkeleton();
    if (shouldSkeletonizeProducts) renderProductsSkeleton();
    return;
  }

  setShopHeroLoadingState(false);
}

function normalizeShopCategoryToken(value) {
  return String(value || "").trim().toLowerCase();
}

function getShopProductCategories(product) {
  const source = Array.isArray(product?.categories) ? product.categories : [product?.cat];
  const seen = new Set();
  return source
    .map((value) => String(value || "").trim())
    .filter((value) => {
      const token = normalizeShopCategoryToken(value);
      if (!value || seen.has(token)) return false;
      seen.add(token);
      return true;
    });
}

function formatShopMoney(value) {
  const amount = Number(value || 0);
  return `${SHOP_CURRENCY_SYMBOL}${shopMoneyFormatter.format(Number.isFinite(amount) ? amount : 0)}`;
}

function escapeShopHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function humanizeShopCategory(value) {
  return String(value || "")
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getCatalogProducts() {
  if (typeof allProducts !== "undefined" && Array.isArray(allProducts) && allProducts.length) return allProducts;
  if (typeof products !== "undefined" && Array.isArray(products)) return products;
  return [];
}

function getRenderedProducts() {
  if (typeof products !== "undefined" && Array.isArray(products)) return products;
  return [];
}

function normalizeShopFiltersLocal(filters) {
  const seen = new Set(["all"]);
  const next = [{ label: "All Products", value: "all", showInShop: true }];

  (Array.isArray(filters) ? filters : []).forEach((filter) => {
    const value = String(filter?.value || "").trim();
    const token = normalizeShopCategoryToken(value);
    if (!value || !token || token === "all" || seen.has(token)) return;
    seen.add(token);
    next.push({
      label: String(filter?.label || humanizeShopCategory(value)).trim() || humanizeShopCategory(value),
      value,
      showInShop: filter?.showInShop !== false,
    });
  });

  return next;
}

function getAvailableCategoryTokens() {
  const set = new Set();
  getCatalogProducts().forEach((product) => {
    getShopProductCategories(product).forEach((category) => {
      const token = normalizeShopCategoryToken(category);
      if (token) set.add(token);
    });
  });
  return set;
}

function getVisibleFilters() {
  const available = getAvailableCategoryTokens();
  return normalizeShopFiltersLocal(shopSettings?.filters || []).filter((filter) => {
    const token = normalizeShopCategoryToken(filter.value);
    if (token === "all") return true;
    return filter.showInShop !== false && available.has(token);
  });
}

function syncNavSearchCategoryDropdown() {
  const select = document.getElementById("searchCategory");
  if (!select) return;

  const filters = getVisibleFilters();
  const options = filters.length ? filters : [{ label: "All Products", value: "all" }];

  select.innerHTML = options
    .map((filter) => `<option value="${escapeShopHtml(filter.value)}">${escapeShopHtml(filter.label)}</option>`)
    .join("");

  const activeToken = normalizeShopCategoryToken(currentFilter);
  const matching = options.find((filter) => normalizeShopCategoryToken(filter.value) === activeToken);
  select.value = matching ? matching.value : "all";
}

function getActiveFilterLabel(filterValue) {
  const token = normalizeShopCategoryToken(filterValue);
  const matching = getVisibleFilters().find((filter) => normalizeShopCategoryToken(filter.value) === token);
  if (matching) return matching.label;
  return humanizeShopCategory(filterValue);
}

function renderProducts(filterValue) {
  const grid = document.getElementById("products-grid");
  if (!grid) return;
  if (shopSkeletonVisible) return;

  const activeToken = normalizeShopCategoryToken(filterValue || "all");
  const filtered = activeToken === "all"
    ? getRenderedProducts()
    : getRenderedProducts().filter((product) =>
        getShopProductCategories(product).some((category) => normalizeShopCategoryToken(category) === activeToken)
      );

  if (!filtered.length) {
    const loadError = typeof window.getProductsLoadError === "function" ? window.getProductsLoadError() : "";
    if (loadError && !getCatalogProducts().length) {
      const apiBase = typeof window.getSiteBaseUrl === "function" ? window.getSiteBaseUrl() : "";
      grid.innerHTML = `<div class="shop-filter-fallback">We couldn't load the shop data. Make sure the backend is running at ${escapeShopHtml(apiBase || "http://127.0.0.1:3000")} and reload this page.</div>`;
      return;
    }
    const label = activeToken === "all" ? "all products" : getActiveFilterLabel(filterValue);
    grid.innerHTML = `<div class="shop-filter-fallback">No products are available in ${escapeShopHtml(label)} yet.</div>`;
    return;
  }

  grid.innerHTML = filtered
    .map((product) => `
      <div
        class="product-card product-card-selectable"
        role="button"
        tabindex="0"
        onclick="openProductSelection('${String(product.id).replace(/'/g, "\\'")}')"
        onkeydown="handleProductCardKeydown(event, '${String(product.id).replace(/'/g, "\\'")}')"
        aria-label="View details for ${escapeShopHtml(product.name)}"
      >
        <div class="product-img" style="background:${product.color || "#f5f7ff"}">
          ${product.badge ? `<div class="product-badge-tag ${product.badgeType || ""}">${escapeShopHtml(product.badge)}</div>` : ""}
          ${
            product.imageUrl
              ? `<img src="${escapeShopHtml(product.imageUrl)}" alt="${escapeShopHtml(product.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`
              : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#5f6b95;font-weight:600;">No image</div>`
          }
        </div>
        <div class="product-info">
          <div class="product-category-list">
            ${getShopProductCategories(product)
              .slice(0, 3)
              .map((category) => `<span class="product-category-chip">${escapeShopHtml(humanizeShopCategory(category))}</span>`)
              .join("")}
          </div>
          <div class="product-name">${escapeShopHtml(product.name)}</div>
          ${typeof renderProductRatingMarkup === "function" ? renderProductRatingMarkup(product) : ""}
          <div class="product-footer">
            <div class="product-price">
              ${product.oldPrice ? `<span class="old-price">${formatShopMoney(product.oldPrice)}</span>` : ""}
              ${formatShopMoney(product.price)}
            </div>
            <button class="add-to-cart-btn" onclick="addToCart('${String(product.id).replace(/'/g, "\\'")}', event)">+ Add</button>
          </div>
        </div>
      </div>
    `)
    .join("");
}

function setActiveFilterButton(filterValue) {
  const activeToken = normalizeShopCategoryToken(filterValue);
  document.querySelectorAll(".filter-btn").forEach((button) => {
    const buttonToken = normalizeShopCategoryToken(button.getAttribute("data-filter"));
    button.classList.toggle("active", buttonToken === activeToken);
  });
}

function setShopFilter(filterValue) {
  const requestedToken = normalizeShopCategoryToken(filterValue || "all") || "all";
  const visibleFilters = getVisibleFilters();
  const matching = visibleFilters.find((filter) => normalizeShopCategoryToken(filter.value) === requestedToken);
  const nextFilter = matching ? matching.value : "all";

  currentFilter = nextFilter;
  setActiveFilterButton(nextFilter);
  syncNavSearchCategoryDropdown();
  renderProducts(nextFilter);
}

function filterProducts(_button, filterValue) {
  setShopFilter(filterValue);
}

window.filterProducts = filterProducts;
window.renderProducts = renderProducts;
window.setShopFilter = setShopFilter;

function renderShopFilters(filters) {
  const wrap = document.querySelector(".shop-filters");
  if (!wrap) return;

  const visibleFilters = normalizeShopFiltersLocal(filters).filter((filter) => {
    const token = normalizeShopCategoryToken(filter.value);
    return token === "all" || getAvailableCategoryTokens().has(token) ? filter.showInShop !== false || token === "all" : false;
  });
  const buttons = visibleFilters.length ? visibleFilters : [{ label: "All Products", value: "all", showInShop: true }];
  const currentToken = normalizeShopCategoryToken(currentFilter);
  const active = buttons.find((filter) => normalizeShopCategoryToken(filter.value) === currentToken) || buttons[0];

  currentFilter = active.value;
  wrap.innerHTML = buttons
    .map((filter) => `
      <button
        type="button"
        class="filter-btn ${normalizeShopCategoryToken(filter.value) === normalizeShopCategoryToken(active.value) ? "active" : ""}"
        data-filter="${escapeShopHtml(filter.value)}"
        onclick="filterProducts(this, '${String(filter.value).replace(/'/g, "\\'")}')"
      >${escapeShopHtml(filter.label)}</button>
    `)
    .join("");

  syncNavSearchCategoryDropdown();
  renderProducts(active.value);
}

async function loadShopSettings() {
  setShopLoadingState(true, { products: !getCatalogProducts().length });

  try {
    const response = await apiFetch("/api/cms/shop", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data?.settings) {
      shopSettings = { title: "", subtitle: "", filters: [{ label: "All Products", value: "all", showInShop: true }] };
      setShopLoadingState(false);
      renderShopFilters(shopSettings.filters);
      return;
    }

    shopSettings = data.settings;

    const hero = document.querySelector(".shop-hero");
    if (hero) {
      const title = hero.querySelector("h1");
      const subtitle = hero.querySelector("p");
      if (title) title.textContent = shopSettings.title || "Shop";
      if (subtitle) subtitle.textContent = shopSettings.subtitle || "Discover products tailored to your needs";
    }

    setShopLoadingState(false);
    renderShopFilters(shopSettings.filters || []);
  } catch (_e) {
    shopSettings = { title: "", subtitle: "", filters: [{ label: "All Products", value: "all", showInShop: true }] };
    setShopLoadingState(false);
    renderShopFilters(shopSettings.filters);
  }
}

async function refreshShopContent(options = {}) {
  if (options?.forceProducts === true && typeof loadProducts === "function") {
    await loadProducts({ force: true });
  }
  await loadShopSettings();
}

window.loadShopSettings = loadShopSettings;
window.refreshShopContent = refreshShopContent;

document.addEventListener("DOMContentLoaded", async () => {
  setShopLoadingState(true);
  if ((!Array.isArray(getRenderedProducts()) || !getRenderedProducts().length) && typeof loadProducts === "function") {
    await loadProducts();
  }
  await loadShopSettings();
});
