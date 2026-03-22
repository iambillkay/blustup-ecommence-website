// ─────────────────────────────────────
// shop.js — Product Filtering & Rendering (CMS dropdown filters)
// ─────────────────────────────────────

let currentFilter = "all";
let shopSettings = null;

function getVisibleFilters() {
  const raw = shopSettings?.filters || [];
  return raw.filter((f) => f && f.showInShop !== false);
}

function syncNavSearchCategoryDropdown() {
  const vis = getVisibleFilters();
  const sel = document.getElementById("searchCategory");
  if (!sel || !vis.length) return;
  sel.innerHTML = vis
    .map((f) => `<option value="${String(f.value).replace(/"/g, "&quot;")}">${escapeHtml(f.label)}</option>`)
    .join("");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderProducts(filter) {
  const grid = document.getElementById("products-grid");
  if (!grid) return;
  const filtered = filter === "all" ? products : products.filter((p) => p.cat === filter);

  grid.innerHTML = filtered
    .map(
      (p) => `
    <div class="product-card">
      <div class="product-img" style="background:${p.color}">
        ${p.badge ? `<div class="product-badge-tag ${p.badgeType}">${p.badge}</div>` : ""}
        ${
          p.imageUrl
            ? `<img src="${p.imageUrl}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`
            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#5f6b95;font-weight:600;">No image</div>`
        }
      </div>
      <div class="product-info">
        <div class="product-category">${p.cat}</div>
        <div class="product-name">${p.name}</div>
        <div class="product-desc">${p.desc}</div>
        <div class="product-footer">
          <div class="product-price">
            ${p.oldPrice ? `<span class="old-price">$${p.oldPrice}</span>` : ""}
            $${p.price}
          </div>
          <button class="add-to-cart-btn" onclick="addToCart('${String(p.id).replace(/'/g, "\\'")}', event)">+ Add</button>
        </div>
      </div>
    </div>
  `
    )
    .join("");
}

function filterProducts(btn, filter) {
  document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  currentFilter = filter || "all";
  renderProducts(currentFilter);
}

function setShopFilter(filter) {
  const v = filter || "all";
  const vis = getVisibleFilters();
  const allowed = new Set(vis.map((f) => f.value));
  const use = allowed.has(v) ? v : "all";
  currentFilter = use;
  document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
  const btn = document.querySelector(`.filter-btn[onclick*="'${String(use).replace(/'/g, "\\'")}'"]`);
  if (btn) btn.classList.add("active");
  const nav = document.getElementById("searchCategory");
  if (nav && nav.value !== use) nav.value = use;
  renderProducts(use);
}

window.setShopFilter = setShopFilter;

function renderShopFilters(filters) {
  const wrap = document.querySelector(".shop-filters");
  if (!wrap || !Array.isArray(filters) || !filters.length) return;
  const vis = filters.filter((f) => f && f.showInShop !== false);
  if (!vis.length) {
    wrap.innerHTML = `<p class="shop-filter-fallback">No filters available. Check admin settings.</p>`;
    return;
  }

  let initial = currentFilter;
  if (!vis.some((f) => f.value === initial)) initial = vis[0].value;
  currentFilter = initial;

  wrap.innerHTML = vis
    .map(
      (f) =>
        `<button type="button" class="filter-btn ${f.value === initial ? "active" : ""}" onclick="filterProducts(this,'${String(f.value).replace(/'/g, "\\'")}')">${escapeHtml(f.label)}</button>`
    )
    .join("");

  renderProducts(initial);
}

async function loadShopSettings() {
  try {
    const res = await fetch("/api/cms/shop");
    const data = await res.json();
    if (!res.ok || !data?.settings) return;
    shopSettings = data.settings;

    const hero = document.querySelector(".shop-hero");
    if (hero) {
      const h1 = hero.querySelector("h1");
      const p = hero.querySelector("p");
      if (h1 && shopSettings.title) h1.textContent = shopSettings.title;
      if (p && shopSettings.subtitle) p.textContent = shopSettings.subtitle;
    }
    renderShopFilters(shopSettings.filters || []);
    syncNavSearchCategoryDropdown();
  } catch (_e) {
    // keep defaults from HTML
  }
}

document.addEventListener("DOMContentLoaded", loadShopSettings);
