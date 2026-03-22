// ─────────────────────────────────────
// cart.js — Cart state, persistence, promos, totals
// ─────────────────────────────────────

const CART_KEY = "blustup_cart_v2";
const PROMO_KEY = "blustup_cart_promo";

let cart = [];
/** @type {{ code: string|null, percent: number, label: string, freeShip?: boolean }} */
let appliedPromo = { code: null, percent: 0, label: "", freeShip: false };

function cartItemFromProduct(p, qty) {
  return {
    id: String(p.id),
    name: p.name,
    desc: p.desc,
    cat: p.cat,
    price: Number(p.price),
    color: p.color,
    icon: p.icon,
    imageUrl: p.imageUrl,
    qty: qty || 1,
  };
}

function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    cart = parsed.map((row) => ({
      ...row,
      id: String(row.id),
      price: Number(row.price),
      qty: Math.max(1, Number(row.qty) || 1),
    }));
  } catch (_e) {
    cart = [];
  }
}

function saveCartToStorage() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch (_e) {}
}

function loadPromoFromStorage() {
  try {
    const raw = localStorage.getItem(PROMO_KEY);
    if (!raw) return;
    appliedPromo = JSON.parse(raw);
  } catch (_e) {
    appliedPromo = { code: null, percent: 0, label: "" };
  }
}

function savePromoToStorage() {
  try {
    localStorage.setItem(PROMO_KEY, JSON.stringify(appliedPromo));
  } catch (_e) {}
}

function addToCart(id, e) {
  e && e.stopPropagation();
  const pid = String(id);
  const product = products.find((p) => String(p.id) === pid);
  if (!product) return;
  const existing = cart.find((i) => String(i.id) === pid);
  if (existing) {
    existing.qty++;
  } else {
    cart.push(cartItemFromProduct(product, 1));
  }
  updateCartCount();
  saveCartToStorage();
  showToast("✓", `${product.name} added to cart`);
}

function changeQty(id, delta) {
  const pid = String(id);
  const item = cart.find((i) => String(i.id) === pid);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter((i) => String(i.id) !== pid);
  updateCartCount();
  saveCartToStorage();
  renderCart();
}

function removeFromCart(id) {
  const pid = String(id);
  cart = cart.filter((i) => String(i.id) !== pid);
  updateCartCount();
  saveCartToStorage();
  renderCart();
}

const KNOWN_PROMOS = {
  AIRLUME20: { percent: 0.2, label: "20% off (AIRLUME20)" },
  BLUSTUP10: { percent: 0.1, label: "10% off (BLUSTUP10)" },
  FREESHIP: { percent: 0, label: "Free shipping (FREESHIP)", freeShip: true },
};

function applyPromo() {
  const val = document.getElementById("promo-input")?.value.trim().toUpperCase() || "";
  if (!val) {
    showToast("!", "Enter a promo code");
    return;
  }
  const p = KNOWN_PROMOS[val];
  if (!p) {
    appliedPromo = { code: null, percent: 0, label: "", freeShip: false };
    savePromoToStorage();
    showToast("✕", "Invalid or expired promo code");
    renderCart();
    return;
  }
  appliedPromo = { code: val, percent: p.percent, label: p.label, freeShip: !!p.freeShip };
  savePromoToStorage();
  showToast("🎉", p.label + " applied");
  renderCart();
}

function clearPromo() {
  appliedPromo = { code: null, percent: 0, label: "", freeShip: false };
  savePromoToStorage();
  const input = document.getElementById("promo-input");
  if (input) input.value = "";
  renderCart();
}

function getSubtotal() {
  return cart.reduce((sum, i) => sum + i.price * i.qty, 0);
}

function getDiscount() {
  const sub = getSubtotal();
  return Math.min(sub, sub * (appliedPromo.percent || 0));
}

function getSubtotalAfterDiscount() {
  return Math.max(0, getSubtotal() - getDiscount());
}

function getShipping() {
  const sub = getSubtotalAfterDiscount();
  if (appliedPromo.freeShip) return 0;
  if (sub >= 50) return 0;
  return 5.99;
}

function getTax() {
  const taxable = getSubtotalAfterDiscount() + getShipping();
  return taxable * 0.08;
}

function getTotal() {
  return getSubtotalAfterDiscount() + getShipping() + getTax();
}

function getTotalItems() {
  return cart.reduce((sum, i) => sum + i.qty, 0);
}

function updateCartCount() {
  const n = String(getTotalItems());
  const el = document.getElementById("cart-count");
  const mob = document.getElementById("cart-count-mobile");
  if (el) el.textContent = n;
  if (mob) mob.textContent = n;
}

/** Clears cart + promo (e.g. after successful checkout) */
function resetCartState() {
  cart = [];
  appliedPromo = { code: null, percent: 0, label: "", freeShip: false };
  saveCartToStorage();
  savePromoToStorage();
  updateCartCount();
}
window.resetCartState = resetCartState;

function renderCart() {
  const container = document.getElementById("cart-items-container");
  const empty = document.getElementById("empty-cart");
  const summaryRows = document.getElementById("cart-summary-rows");
  const totalEl = document.getElementById("cart-total-display");
  const promoHint = document.getElementById("promo-status");

  if (!container || !summaryRows || !totalEl) return;

  if (cart.length === 0) {
    container.style.display = "none";
    if (empty) empty.style.display = "block";
    summaryRows.innerHTML = "";
    totalEl.textContent = "$0.00";
    if (promoHint) promoHint.textContent = "";
    return;
  }

  container.style.display = "flex";
  if (empty) empty.style.display = "none";

  container.innerHTML = cart
    .map(
      (item) => `
    <div class="cart-item" id="cart-item-${String(item.id).replace(/[^a-z0-9_-]/gi, "")}">
      <div class="cart-item-thumb">
        ${
          item.imageUrl
            ? `<img src="${item.imageUrl}" alt="">`
            : `<div class="cart-thumb-fallback" style="background:${item.color || "#e8ebff"}">${item.icon || "◆"}</div>`
        }
      </div>
      <div class="cart-item-info">
        <div class="cat">${item.cat}</div>
        <div class="name">${item.name}</div>
        <div class="desc">${item.desc}</div>
        <div class="qty-control">
          <button type="button" class="qty-btn" onclick="changeQty('${String(item.id).replace(/'/g, "\\'")}', -1)">−</button>
          <span class="qty-val">${item.qty}</span>
          <button type="button" class="qty-btn" onclick="changeQty('${String(item.id).replace(/'/g, "\\'")}', 1)">+</button>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
        <div class="cart-item-price">$${(item.price * item.qty).toFixed(2)}</div>
        <button type="button" class="remove-btn" onclick="removeFromCart('${String(item.id).replace(/'/g, "\\'")}')">Remove</button>
      </div>
    </div>
  `
    )
    .join("");

  const ship = getShipping();
  const disc = getDiscount();
  const promoLine =
    appliedPromo.code && disc > 0
      ? `<div class="summary-row discount"><span>Discount (${appliedPromo.code})</span><span>−$${disc.toFixed(2)}</span></div>`
      : "";
  const shipNote = ship === 0 ? "FREE" : `$${ship.toFixed(2)}`;

  summaryRows.innerHTML = `
    <div class="summary-row">
      <span>Subtotal (${getTotalItems()} items)</span>
      <span>$${getSubtotal().toFixed(2)}</span>
    </div>
    ${promoLine}
    <div class="summary-row">
      <span>Shipping ${getSubtotalAfterDiscount() < 50 && !appliedPromo.freeShip ? "(free over $50)" : ""}</span>
      <span>${shipNote}</span>
    </div>
    <div class="summary-row">
      <span>Estimated tax (8%)</span>
      <span>$${getTax().toFixed(2)}</span>
    </div>
  `;
  totalEl.textContent = "$" + getTotal().toFixed(2);
  if (promoHint) {
    promoHint.textContent = appliedPromo.code
      ? appliedPromo.label || `Promo ${appliedPromo.code} applied`
      : "Try AIRLUME20, BLUSTUP10, or FREESHIP";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadCartFromStorage();
  loadPromoFromStorage();
  updateCartCount();
});
