// ─────────────────────────────────────
// checkout.js — Checkout Page Logic
// ─────────────────────────────────────

function renderCheckout() {
  const miniCart    = document.getElementById('checkout-mini-cart');
  const summaryRows = document.getElementById('checkout-summary-rows');
  const totalEl     = document.getElementById('checkout-total-display');

  miniCart.innerHTML = cart.map(item => `
    <div class="mini-cart-item">
      <div class="mini-cart-icon" style="background:${item.color}">${item.icon}</div>
      <div class="mini-cart-info">
        <div class="n">${item.name}</div>
        <div class="q">Qty: ${item.qty}</div>
      </div>
      <div class="mini-cart-price">$${(item.price * item.qty).toFixed(2)}</div>
    </div>
  `).join('');

  summaryRows.innerHTML = `
    <div class="summary-row">
      <span>Subtotal</span>
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

function placeOrder() {
  const ref = '#AIR-' + Math.floor(10000 + Math.random() * 90000);
  document.getElementById('order-ref').textContent = ref;
  cart = [];
  updateCartCount();
  showPage('success');
}

/* ── Payment Icon Toggle ── */
document.addEventListener('click', e => {
  if (e.target.classList.contains('pay-icon')) {
    document.querySelectorAll('.pay-icon').forEach(el => el.classList.remove('active'));
    e.target.classList.add('active');
  }
});
