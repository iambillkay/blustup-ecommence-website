// ─────────────────────────────────────
// shop.js — Product Filtering & Rendering
// ─────────────────────────────────────

let currentFilter = 'all';

function renderProducts(filter) {
  const grid     = document.getElementById('products-grid');
  const filtered = filter === 'all' ? products : products.filter(p => p.cat === filter);

  grid.innerHTML = filtered.map(p => `
    <div class="product-card">
      <div class="product-img" style="background:${p.color}">
        ${p.badge ? `<div class="product-badge-tag ${p.badgeType}">${p.badge}</div>` : ''}
        <span>${p.icon}</span>
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
          <button class="add-to-cart-btn" onclick="addToCart(${p.id}, event)">+ Add</button>
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
