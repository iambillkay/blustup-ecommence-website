// ─────────────────────────────────────
// app.js — Router, Toast & App Init
// ─────────────────────────────────────

/* ── PAGE ROUTER ── */
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');

  // Update active nav link
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active-link'));
  const navEl = document.getElementById('nav-' + name);
  if (navEl) navEl.classList.add('active-link');

  window.scrollTo(0, 0);

  // Trigger page-specific renderers
  if (name === 'cart')     renderCart();
  if (name === 'checkout') renderCheckout();
}

/* ── TOAST ── */
function showToast(icon, msg) {
  const t = document.getElementById('toast');
  document.getElementById('toast-icon').textContent = icon;
  document.getElementById('toast-msg').textContent  = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

/* ── INIT ── */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof loadProducts === "function") {
    loadProducts().finally(() => renderProducts('all'));
  } else {
    renderProducts('all');
  }
});
