/* ─── Premium Cart & Checkout System ─── */
const CART_KEY = "blustup_cart_v2";
const PROMO_KEY = "blustup_cart_promo";
const CART_CURRENCY_SYMBOL = "\u20B5";
const cartMoneyFormatter = new Intl.NumberFormat("en-GH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

let cart = [];
let appliedPromo = { code: null, percent: 0, label: "", freeShip: false };

function formatCartMoney(value) {
  const amount = Number(value || 0);
  return `${CART_CURRENCY_SYMBOL}${cartMoneyFormatter.format(Number.isFinite(amount) ? amount : 0)}`;
}

function escapeCartHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function findProductById(id) {
  if (typeof allProducts !== "undefined" && Array.isArray(allProducts)) {
    return allProducts.find(p => String(p.id) === String(id));
  }
  return null;
}

function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (raw) cart = JSON.parse(raw);
  } catch (_e) { cart = []; }
}

function saveCartToStorage() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch (_e) {}
}

function loadPromoFromStorage() {
  try {
    const raw = localStorage.getItem(PROMO_KEY);
    if (raw) appliedPromo = JSON.parse(raw);
  } catch (_e) {}
}

function savePromoToStorage() {
  try {
    localStorage.setItem(PROMO_KEY, JSON.stringify(appliedPromo));
  } catch (_e) {}
}

function updateCartCount() {
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  const desktop = document.getElementById("cart-count");
  const mobile = document.getElementById("cart-count-mobile");
  if (desktop) desktop.textContent = count;
  if (mobile) mobile.textContent = count;
}

function syncDependentViews() {
  updateCartCount();
  saveCartToStorage();
  updateShippingTracker();
  if (isCartPageActive()) renderCart();
  if (typeof renderCheckout === "function") renderCheckout();
}

function isCartPageActive() {
  const page = document.getElementById("page-cart");
  return page && (page.style.display === "block" || !page.style.display);
}

function addToCart(id, e) {
  if (e) e.stopPropagation();
  const product = findProductById(id);
  if (!product) return;

  const existing = cart.find(item => String(item.id) === String(id));
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      id: String(product.id),
      name: product.name,
      price: Number(product.price),
      imageUrl: product.imageUrl,
      color: product.color,
      cat: product.cat || product.category || "General",
      qty: 1
    });
  }

  syncDependentViews();
  if (typeof showToast === "function") showToast("🛒", `${product.name} added to cart`);
}

function changeQty(id, delta) {
  const item = cart.find(entry => String(entry.id) === String(id));
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) {
    removeFromCart(id);
  } else {
    syncDependentViews();
  }
}

function removeFromCart(id) {
  cart = cart.filter(item => String(item.id) !== String(id));
  syncDependentViews();
}

async function saveForLater(id, event) {
  if (event) event.stopPropagation();
  // 1. Add to wishlist
  if (typeof toggleWishlist === "function") {
    const inWish = typeof isInWishlist === "function" ? isInWishlist(id) : false;
    if (!inWish) await toggleWishlist(id, null);
  }
  // 2. Remove from cart
  removeFromCart(id);
  if (typeof showToast === "function") showToast("💝", "Saved for later!");
}

function updateShippingTracker() {
  const tracker = document.getElementById("shippingTracker");
  const text = document.getElementById("shippingTrackerText");
  const fill = document.getElementById("shippingTrackerFill");
  if (!tracker || !text || !fill) return;

  const subtotal = getSubtotalAfterDiscount();
  const threshold = 50.00;
  
  if (subtotal === 0) {
    tracker.style.opacity = "0.5";
    text.textContent = `Free shipping on orders over ${formatCartMoney(threshold)}`;
    fill.style.width = "0%";
    return;
  }

  tracker.style.opacity = "1";
  if (subtotal >= threshold) {
    text.innerHTML = "🎉 <strong>Congrats!</strong> You've unlocked FREE SHIPPING!";
    fill.style.width = "100%";
    fill.classList.add("completed");
  } else {
    const remaining = threshold - subtotal;
    const percent = (subtotal / threshold) * 100;
    text.innerHTML = `Only <strong>${formatCartMoney(remaining)}</strong> away from <strong>FREE SHIPPING!</strong>`;
    fill.style.width = `${percent}%`;
    fill.classList.remove("completed");
  }
}

function getSubtotal() {
  return cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
}

function getDiscount() {
  return getSubtotal() * (appliedPromo.percent || 0);
}

function getSubtotalAfterDiscount() {
  return Math.max(0, getSubtotal() - getDiscount());
}

function getShipping() {
  const sub = getSubtotalAfterDiscount();
  if (sub === 0 || sub >= 50 || appliedPromo.freeShip) return 0;
  return 5.99;
}

function getTax() {
  return (getSubtotalAfterDiscount() + getShipping()) * 0.08;
}

function getTotal() {
  return getSubtotalAfterDiscount() + getShipping() + getTax();
}

function applyPromo() {
  const input = document.getElementById("promo-input");
  const code = (input?.value || "").trim().toUpperCase();
  const KNOWN = { "AIRLUME20": 0.2, "BLUSTUP10": 0.1, "FREESHIP": 0 };
  
  if (code in KNOWN) {
    appliedPromo = { 
      code, 
      percent: KNOWN[code], 
      label: code === "FREESHIP" ? "Free Shipping" : `${KNOWN[code]*100}% Discount`,
      freeShip: code === "FREESHIP"
    };
    savePromoToStorage();
    if (typeof showToast === "function") showToast("🎫", "Promo applied!");
    syncDependentViews();
  } else {
    if (typeof showToast === "function") showToast("!", "Invalid code");
  }
}

function renderCart() {
  const container = document.getElementById("cart-items-container");
  const empty = document.getElementById("empty-cart");
  const summaryRows = document.getElementById("cart-summary-rows");
  const totalDisplay = document.getElementById("cart-total-display");
  
  if (!container || !summaryRows || !totalDisplay) return;

  if (!cart.length) {
    container.style.display = "none";
    if (empty) empty.style.display = "block";
    totalDisplay.textContent = formatCartMoney(0);
    return;
  }

  container.style.display = "block";
  if (empty) empty.style.display = "none";

  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-thumb" style="background:${item.color || '#f8fafc'}">
        <img src="${escapeCartHtml(item.imageUrl)}" alt="${escapeCartHtml(item.name)}" onerror="this.src='product-imgs/placeholder.png'">
      </div>
      <div class="cart-item-info">
        <span class="cart-item-cat">${escapeCartHtml(item.cat)}</span>
        <h3 class="cart-item-name">${escapeCartHtml(item.name)}</h3>
        <div class="cart-item-actions">
          <button class="save-later-btn" onclick="saveForLater('${item.id}', event)">Save for later</button>
          <button class="remove-btn" onclick="removeFromCart('${item.id}')">Remove</button>
        </div>
      </div>
      <div class="cart-item-controls">
        <div class="qty-stepper">
          <button onclick="changeQty('${item.id}', -1)">${item.qty === 1 ? '🗑️' : '-'}</button>
          <span>${item.qty}</span>
          <button onclick="changeQty('${item.id}', 1)">+</button>
        </div>
        <div class="cart-item-price">${formatCartMoney(item.price * item.qty)}</div>
      </div>
    </div>
  `).join("");

  const sub = getSubtotal();
  const disc = getDiscount();
  const ship = getShipping();
  const tax = getTax();

  let rowsHtml = `
    <div class="summary-row"><span>Subtotal</span><span>${formatCartMoney(sub)}</span></div>
  `;
  if (disc > 0) {
    rowsHtml += `<div class="summary-row discount"><span>Discount</span><span>-${formatCartMoney(disc)}</span></div>`;
  }
  rowsHtml += `
    <div class="summary-row"><span>Shipping</span><span>${ship === 0 ? 'FREE' : formatCartMoney(ship)}</span></div>
    <div class="summary-row"><span>Estimated Tax</span><span>${formatCartMoney(tax)}</span></div>
  `;
  
  summaryRows.innerHTML = rowsHtml;
  totalDisplay.textContent = formatCartMoney(getTotal());
  updateShippingTracker();
}

window.addToCart = addToCart;
window.changeQty = changeQty;
window.removeFromCart = removeFromCart;
window.saveForLater = saveForLater;
window.applyPromo = applyPromo;

document.addEventListener("DOMContentLoaded", () => {
  loadCartFromStorage();
  loadPromoFromStorage();
  updateCartCount();
  if (isCartPageActive()) renderCart();
});
