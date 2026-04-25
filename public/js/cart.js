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
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getProductCatalog() {
  if (Array.isArray(allProducts) && allProducts.length) return allProducts;
  if (Array.isArray(products) && products.length) return products;
  return [];
}

function findProductById(id) {
  const pid = String(id);
  return getProductCatalog().find((product) => String(product.id) === pid) || null;
}

function getCartProductCategories(product) {
  const source = Array.isArray(product?.categories) ? product.categories : [product?.cat];
  const seen = new Set();
  return source
    .map((value) => String(value || "").trim())
    .filter((value) => {
      const token = value.toLowerCase();
      if (!value || seen.has(token)) return false;
      seen.add(token);
      return true;
    });
}

function cartItemFromProduct(product, qty) {
  const categories = getCartProductCategories(product);
  return {
    id: String(product.id),
    name: product.name,
    desc: product.desc,
    cat: categories[0] || product.cat,
    categories,
    price: Number(product.price),
    color: product.color,
    icon: product.icon,
    imageUrl: product.imageUrl,
    qty: Math.max(1, Number(qty) || 1),
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
    appliedPromo = { code: null, percent: 0, label: "", freeShip: false };
  }
}

function savePromoToStorage() {
  try {
    localStorage.setItem(PROMO_KEY, JSON.stringify(appliedPromo));
  } catch (_e) {}
}

function updateCartCount() {
  const count = String(getTotalItems());
  const desktop = document.getElementById("cart-count");
  const mobile = document.getElementById("cart-count-mobile");
  [desktop, mobile].forEach((el) => {
    if (el) {
      el.textContent = count;
      el.classList.remove("bump");
      void el.offsetWidth; // Trigger reflow to restart animation
      el.classList.add("bump");
    }
  });
}

function syncDependentViews() {
  updateCartCount();
  saveCartToStorage();
  if (typeof renderCart === "function") renderCart();
  if (typeof renderCheckout === "function") renderCheckout();
}

function addToCart(id, e) {
  e?.stopPropagation?.();
  const product = findProductById(id);
  if (!product) {
    showToast("!", "This product is currently unavailable.");
    return;
  }

  const pid = String(product.id);
  const existing = cart.find((item) => String(item.id) === pid);
  if (existing) existing.qty += 1;
  else cart.push(cartItemFromProduct(product, 1));

  syncDependentViews();
  showToast("OK", `${product.name} added to cart`);

  // Track add to cart
  if (window.tracker) {
    window.tracker.track("add_to_cart", {
      productId: id,
      productName: product.name,
      category: getCartProductCategories(product)[0] || product.cat || "",
      price: Number(product.price || 0),
      page: document.body?.dataset?.page || "unknown",
    });
  }
}

function changeQty(id, delta) {
  const pid = String(id);
  const item = cart.find((entry) => String(entry.id) === pid);
  if (!item) return;

  item.qty += Number(delta) || 0;
  if (item.qty <= 0) {
    cart = cart.filter((entry) => String(entry.id) !== pid);
  }

  syncDependentViews();
}

function removeFromCart(id) {
  const pid = String(id);
  cart = cart.filter((item) => String(item.id) !== pid);
  syncDependentViews();
}

function clearCart() {
  if (!cart.length) return;
  cart = [];
  appliedPromo = { code: null, percent: 0, label: "", freeShip: false };
  savePromoToStorage();
  syncDependentViews();
}

const KNOWN_PROMOS = {
  AIRLUME20: { percent: 0.2, label: "20% off (AIRLUME20)" },
  BLUSTUP10: { percent: 0.1, label: "10% off (BLUSTUP10)" },
  FREESHIP: { percent: 0, label: "Free shipping (FREESHIP)", freeShip: true },
};

function applyPromo() {
  const input = document.getElementById("promo-input");
  const value = String(input?.value || "").trim().toUpperCase();

  if (!value) {
    showToast("!", "Enter a promo code");
    return;
  }

  const promo = KNOWN_PROMOS[value];
  if (!promo) {
    appliedPromo = { code: null, percent: 0, label: "", freeShip: false };
    savePromoToStorage();
    showToast("X", "Invalid or expired promo code");
    renderCart();
    return;
  }

  appliedPromo = {
    code: value,
    percent: promo.percent,
    label: promo.label,
    freeShip: !!promo.freeShip,
  };
  savePromoToStorage();
  showToast("OK", `${promo.label} applied`);
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
  return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function getDiscount() {
  const subtotal = getSubtotal();
  return Math.min(subtotal, subtotal * (appliedPromo.percent || 0));
}

function getSubtotalAfterDiscount() {
  return Math.max(0, getSubtotal() - getDiscount());
}

function getShipping() {
  const subtotalAfterDiscount = getSubtotalAfterDiscount();
  const loyalty = typeof getCurrentLoyaltyState === "function"
    ? getCurrentLoyaltyState(typeof getStoredUser === "function" ? getStoredUser() : null)
    : null;
  if (!cart.length) return 0;
  if (appliedPromo.freeShip) return 0;
  if (loyalty?.freeShippingEligible) return 0;
  if (subtotalAfterDiscount >= 50) return 0;
  return 5.99;
}

function getTax() {
  if (!cart.length) return 0;
  const taxable = getSubtotalAfterDiscount() + getShipping();
  return taxable * 0.08;
}

function getTotal() {
  return getSubtotalAfterDiscount() + getShipping() + getTax();
}

function getTotalItems() {
  return cart.reduce((sum, item) => sum + item.qty, 0);
}

function reconcileCartWithProducts() {
  if (!cart.length) return;

  cart = cart.map((item) => {
    const latest = findProductById(item.id);
    if (!latest) return item;
    return cartItemFromProduct(latest, item.qty);
  });

  syncDependentViews();
}
window.reconcileCartWithProducts = reconcileCartWithProducts;

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
  const promoInput = document.getElementById("promo-input");
  const promoApplyButton = document.getElementById("promoApplyBtn");
  const checkoutButton = document.getElementById("cartCheckoutBtn");
  const clearButton = document.getElementById("clearCartBtn");

  if (!container || !summaryRows || !totalEl) return;

  if (!cart.length) {
    container.style.display = "none";
    if (empty) empty.style.display = "block";
    summaryRows.innerHTML = `
      <div class="summary-row">
        <span>Subtotal</span>
        <span>${formatCartMoney(0)}</span>
      </div>
      <div class="summary-row">
        <span>Shipping</span>
        <span>${formatCartMoney(0)}</span>
      </div>
      <div class="summary-row">
        <span>Estimated tax</span>
        <span>${formatCartMoney(0)}</span>
      </div>
    `;
    totalEl.textContent = formatCartMoney(0);
    if (promoHint) promoHint.textContent = "Add items to your cart to apply a promo code.";
    if (promoInput) {
      promoInput.disabled = true;
      promoInput.value = "";
    }
    if (promoApplyButton) promoApplyButton.disabled = true;
    if (checkoutButton) checkoutButton.disabled = true;
    if (clearButton) clearButton.disabled = true;
    return;
  }

  container.style.display = "flex";
  if (empty) empty.style.display = "none";

  if (promoInput) promoInput.disabled = false;
  if (promoApplyButton) promoApplyButton.disabled = false;
  if (checkoutButton) checkoutButton.disabled = false;
  if (clearButton) clearButton.disabled = false;

  container.innerHTML = cart
    .map((item) => {
      const safeId = String(item.id).replace(/'/g, "\\'");
      return `
        <div class="cart-item" id="cart-item-${String(item.id).replace(/[^a-z0-9_-]/gi, "")}">
          <div class="cart-item-thumb">
            ${
              item.imageUrl
                ? `<img src="${escapeCartHtml(item.imageUrl)}" alt="${escapeCartHtml(item.name)}">`
                : `<div class="cart-thumb-fallback" style="background:${escapeCartHtml(item.color || "#e8ebff")}">${escapeCartHtml(item.icon || "*")}</div>`
            }
          </div>
          <div class="cart-item-info">
            <div class="cat">${escapeCartHtml(item.cat)}</div>
            <div class="name">${escapeCartHtml(item.name)}</div>
            <div class="desc">${escapeCartHtml(item.desc)}</div>
            <div class="qty-control">
              <button type="button" class="qty-btn" onclick="changeQty('${safeId}', -1)">-</button>
              <span class="qty-val">${item.qty}</span>
              <button type="button" class="qty-btn" onclick="changeQty('${safeId}', 1)">+</button>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
            <div class="cart-item-price">${formatCartMoney(item.price * item.qty)}</div>
            <button type="button" class="remove-btn" onclick="removeFromCart('${safeId}')">Remove</button>
          </div>
        </div>
      `;
    })
    .join("");

  const shipping = getShipping();
  const discount = getDiscount();
  const loyalty = typeof getCurrentLoyaltyState === "function"
    ? getCurrentLoyaltyState(typeof getStoredUser === "function" ? getStoredUser() : null)
    : null;
  const shippingLabel = loyalty?.freeShippingEligible
    ? `(included with ${escapeCartHtml(loyalty.tierName || "loyalty")})`
    : getSubtotalAfterDiscount() < 50 && !appliedPromo.freeShip
      ? `(free over ${formatCartMoney(50)})`
      : "";
  const discountLine =
    appliedPromo.code && discount > 0
      ? `<div class="summary-row discount"><span>Discount (${escapeCartHtml(appliedPromo.code)})</span><span>-${formatCartMoney(discount)}</span></div>`
      : "";

  summaryRows.innerHTML = `
    <div class="summary-row">
      <span>Subtotal (${getTotalItems()} items)</span>
      <span>${formatCartMoney(getSubtotal())}</span>
    </div>
    ${discountLine}
    <div class="summary-row">
      <span>Shipping ${shippingLabel}</span>
      <span>${shipping === 0 ? "FREE" : formatCartMoney(shipping)}</span>
    </div>
    <div class="summary-row">
      <span>Estimated tax (8%)</span>
      <span>${formatCartMoney(getTax())}</span>
    </div>
  `;

  totalEl.textContent = formatCartMoney(getTotal());
  if (promoHint) {
    promoHint.textContent = appliedPromo.code
      ? appliedPromo.label || `Promo ${appliedPromo.code} applied`
      : loyalty?.freeShippingEligible
        ? `${loyalty.tierName} loyalty perk active - Free shipping applied`
        : "Try AIRLUME20, BLUSTUP10, or FREESHIP";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadCartFromStorage();
  loadPromoFromStorage();
  updateCartCount();
  renderCart();
  document.getElementById("clearCartBtn")?.addEventListener("click", clearCart);
});
