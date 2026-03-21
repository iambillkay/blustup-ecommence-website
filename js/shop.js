// ─────────────────────────────────────
// shop.js — Product Filtering & Rendering
// ─────────────────────────────────────

let currentFilter = 'all';
let shopSettings = null;

function renderProducts(filter) {
  const grid     = document.getElementById('products-grid');
  const filtered = filter === 'all' ? products : products.filter(p => p.cat === filter);

  grid.innerHTML = filtered.map(p => `
    <div class="product-card">
      <div class="product-img" style="background:${p.color}">
        ${p.badge ? `<div class="product-badge-tag ${p.badgeType}">${p.badge}</div>` : ''}
        ${p.imageUrl ? `<img src="${p.imageUrl}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#5f6b95;font-weight:600;">No image</div>`}
      </div>
      <div class="product-info">
        <div class="product-category">${p.cat}</div>
        <div class="product-name">${p.name}</div>
        <div class="product-desc">${p.desc}</div>
        <div class="product-footer">
          <div class="product-price">
            ${p.oldPrice ? `<span class="old-price">$${p.oldPrice}</span>` : ''}
            $${p.price}
          </div>
          <button class="add-to-cart-btn" onclick="addToCart('${p.id}', event)">+ Add</button>
        </div>
      </div>
    </div>
  `).join('');
}

function filterProducts(btn, filter) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentFilter = filter;
  renderProducts(filter);
}

function renderShopFilters(filters) {
  const wrap = document.querySelector(".shop-filters");
  if (!wrap || !Array.isArray(filters) || !filters.length) return;
  wrap.innerHTML = filters
    .map((f, i) => `<button class="filter-btn ${i === 0 ? "active" : ""}" onclick="filterProducts(this,'${f.value}')">${f.label}</button>`)
    .join("");
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
  } catch (_e) {
    // keep defaults from HTML
  }
}

document.addEventListener("DOMContentLoaded", loadShopSettings);
