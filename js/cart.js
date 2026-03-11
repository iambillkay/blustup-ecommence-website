// ─────────────────────────────────────
// cart.js — Cart State & Rendering
// ─────────────────────────────────────

let cart = [];

/* ── STATE MUTATIONS ── */

function addToCart(id, e) {
  e && e.stopPropagation();
  const product = products.find(p => p.id === id);
  const existing = cart.find(i => i.id === id);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ ...product, qty: 1 });
  }
  updateCartCount();
  showToast('✈', `${product.name} added to cart!`);
}

function changeQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
  updateCartCount();
  renderCart();
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  updateCartCount();
  renderCart();
}

function applyPromo() {
  const val = document.getElementById('promo-input').value.trim().toUpperCase();
  if (val === 'AIRLUME20') {
    showToast('🎉', 'Promo applied! 20% off');
  } else {
    showToast('❌', 'Invalid promo code');
  }
}

/* ── HELPERS ── */

function getSubtotal() {
  return cart.reduce((sum, i) => sum + i.price * i.qty, 0);
}

function getTax() {
  return getSubtotal() * 0.08;
}

function getTotal() {
  return getSubtotal() + getTax() + 2.99;
}

function getTotalItems() {
  return cart.reduce((sum, i) => sum + i.qty, 0);
}

/* ── UI UPDATES ── */

function updateCartCount() {
  document.getElementById('cart-count').textContent = getTotalItems();
}

/* ── CART PAGE RENDERER ── */

function renderCart() {
  const container  = document.getElementById('cart-items-container');
  const empty      = document.getElementById('empty-cart');
  const summaryRows = document.getElementById('cart-summary-rows');
  const totalEl    = document.getElementById('cart-total-display');

  if (cart.length === 0) {
    container.style.display = 'none';
    empty.style.display = 'block';
    summaryRows.innerHTML = '';
    totalEl.textContent = '$0.00';
    return;
  }

  container.style.display = 'flex';
  empty.style.display = 'none';

  container.innerHTML = cart.map(item => `
    <div class="cart-item" id="cart-item-${item.id}">
      <div class="cart-item-icon" style="background:${item.color}">${item.icon}</div>
      <div class="cart-item-info">
        <div class="cat">${item.cat}</div>
        <div class="name">${item.name}</div>
        <div class="desc">${item.desc}</div>
        <div class="qty-control">
          <button class="qty-btn" onclick="changeQty(${item.id}, -1)">−</button>
          <span class="qty-val">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
        <div class="cart-item-price">$${(item.price * item.qty).toFixed(2)}</div>
        <button class="remove-btn" onclick="removeFromCart(${item.id})">✕</button>
      </div>
    </div>
  `).join('');

  summaryRows.innerHTML = `
    <div class="summary-row">
      <span>Subtotal (${getTotalItems()} items)</span>
      <span>$${getSubtotal().toFixed(2)}</span>
    </div>
    <div class="summary-row">
      <span>Tax (8%)</span>
      <span>$${getTax().toFixed(2)}</span>
    </div>
    <div class="summary-row">
      <span>Processing Fee</span>
      <span>$2.99</span>
    </div>
  `;
  totalEl.textContent = '$' + getTotal().toFixed(2);
}
