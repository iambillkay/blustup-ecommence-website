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

function getCartRecommendations(count = 3) {
  const catalog = getProductCatalog();
  const cartIds = new Set(cart.map((item) => String(item.id)));
  
  // Exclude items already in cart
  const available = catalog.filter((p) => !cartIds.has(String(p.id)));
  
  // Shuffle and pick
  return available
    .sort(() => 0.5 - Math.random())
    .slice(0, count);
}

function renderRecCard(product) {
  const safeId = String(product.id).replace(/'/g, "\\'");
  return `
    <div class="mini-rec-card">
      <div class="rec-thumb" style="background:${escapeCartHtml(product.color || "#f0f2ff")}">
        ${product.imageUrl ? `<img src="${escapeCartHtml(product.imageUrl)}" alt="">` : `<span>${escapeCartHtml(product.icon || "★")}</span>`}
      </div>
      <div class="rec-info">
        <div class="rec-name">${escapeCartHtml(product.name)}</div>
        <div class="rec-price">${formatCartMoney(product.price)}</div>
      </div>
      <button class="rec-add-btn" onclick="addToCart('${safeId}', event)" aria-label="Add to cart">
        <svg viewBox="0 0 24 24" width="16" height="16"><path fill="none" stroke="currentColor" stroke-width="2.5" d="M12 5v14M5 12h14"/></svg>
      </button>
    </div>
  `;
}

async function loadCartFromStorage() {
  try {
    const user = typeof getStoredUser === "function" ? getStoredUser() : null;
    const key = user?.id ? `${CART_KEY}_u${user.id}` : `${CART_KEY}_guest`;
    const raw = localStorage.getItem(key);
    if (!raw) {
      cart = [];
      return;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      cart = [];
      return;
    }
    cart = parsed.map((row) => ({
      ...row,
      id: String(row.id),
      price: Number(row.price),
      qty: Math.max(1, Number(row.qty) || 1),
    }));

    // Sync from server if logged in
    if (user?.id && typeof api === "function") {
      try {
        const response = await api("/api/cart");
        if (response && Array.isArray(response.cart)) {
          cart = response.cart;
          updateCartCount();
          renderCart();
        }
      } catch (err) {
        console.warn("Could not sync cart from server", err);
      }
    }
  } catch (_e) {
    cart = [];
  }
}

async function saveCartToStorage() {
  try {
    const user = typeof getStoredUser === "function" ? getStoredUser() : null;
    const key = user?.id ? `${CART_KEY}_u${user.id}` : `${CART_KEY}_guest`;
    localStorage.setItem(key, JSON.stringify(cart));
    if (user?.id && typeof api === "function") {
      api("/api/cart", { method: "PUT", body: JSON.stringify({ cart }) }).catch(() => {});
    }
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
  const count = getTotalItems();
  const badges = document.querySelectorAll(".cart-count");
  const pageBadge = document.getElementById("cart-page-count");
  
  badges.forEach((b) => {
    b.textContent = count;
    b.style.display = count > 0 ? "flex" : "none";
    if (count > 0) {
      b.classList.remove("bump");
      void b.offsetWidth; // trigger reflow
      b.classList.add("bump");
    }
  });

  if (pageBadge) {
    pageBadge.textContent = count;
    pageBadge.style.display = count > 0 ? "inline-flex" : "none";
  }
}

function openCartDrawer() {
  const drawer = document.getElementById("cartDrawer");
  const backdrop = document.getElementById("cartDrawerBackdrop");
  if (!drawer || !backdrop) return;

  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  backdrop.classList.add("active");
  document.body.style.overflow = "hidden"; // Prevent background scroll
  renderCart(); // Refresh view
}
window.openCartDrawer = openCartDrawer;

function closeCartDrawer() {
  const drawer = document.getElementById("cartDrawer");
  const backdrop = document.getElementById("cartDrawerBackdrop");
  if (!drawer || !backdrop) return;

  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  backdrop.classList.remove("active");
  document.body.style.overflow = "";
}
window.closeCartDrawer = closeCartDrawer;

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
    showToast('<svg class="icon" aria-hidden="true"><use xlink:href="#icon-error"></use></svg>', "This product is currently unavailable.");
    return;
  }

  const pid = String(product.id);
  const existing = cart.find((item) => String(item.id) === pid);
  if (existing) existing.qty += 1;
  else cart.push(cartItemFromProduct(product, 1));

  syncDependentViews();
  showToast('<svg class="icon" aria-hidden="true"><use xlink:href="#icon-check"></use></svg>', `${product.name} added to cart`);
  
  // Premium improvement: Automatically open drawer on add
  setTimeout(openCartDrawer, 400);

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
    showToast('<svg class="icon" aria-hidden="true"><use xlink:href="#icon-error"></use></svg>', "Enter a promo code");
    return;
  }

  const promo = KNOWN_PROMOS[value];
  if (!promo) {
    appliedPromo = { code: null, percent: 0, label: "", freeShip: false };
    savePromoToStorage();
    showToast('<svg class="icon" aria-hidden="true"><use xlink:href="#icon-cross"></use></svg>', "Invalid or expired promo code");
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
  showToast('<svg class="icon" aria-hidden="true"><use xlink:href="#icon-check"></use></svg>', `${promo.label} applied`);
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

  // Drawer Elements
  const drawerContainer = document.getElementById("drawer-cart-items-container");
  const drawerEmpty = document.getElementById("drawer-empty-cart");
  const drawerSubtotal = document.getElementById("drawer-subtotal");
  const drawerTotal = document.getElementById("drawer-total");
  const drawerBtnTotal = document.getElementById("drawer-btn-total");
  const drawerShippingText = document.getElementById("shipping-progress-text");
  const drawerShippingFill = document.getElementById("shipping-progress-fill");
  const drawerDiscountRow = document.getElementById("drawer-discount-row");
  const drawerDiscountLabel = document.getElementById("drawer-discount-label");
  const drawerDiscountVal = document.getElementById("drawer-discount-val");
  const drawerDeliveryNote = document.getElementById("drawer-delivery-note");

  // Full Page Elements
  const pageShippingText = document.getElementById("cart-page-shipping-text");
  const pageShippingFill = document.getElementById("cart-page-shipping-fill");
  const pageRecList = document.getElementById("cart-page-rec-list");
  const pageRecContainer = document.getElementById("cart-page-recommendations");

  const subtotal = getSubtotal();
  const total = getTotal();
  const discount = getDiscount();
  const threshold = 50;

  // Update Delivery Estimate
  if (drawerDeliveryNote) {
    const date = new Date();
    date.setDate(date.getDate() + 3);
    const options = { month: 'short', day: 'numeric' };
    drawerDeliveryNote.textContent = `Get it by ${date.toLocaleDateString('en-US', options)}`;
  }

  // Update Drawer Summary
  if (drawerSubtotal) drawerSubtotal.textContent = formatCartMoney(subtotal);
  if (drawerTotal) drawerTotal.textContent = formatCartMoney(total);
  if (drawerBtnTotal) drawerBtnTotal.textContent = formatCartMoney(total);

  if (drawerDiscountRow) {
    if (appliedPromo.code && discount > 0) {
      drawerDiscountRow.style.display = "flex";
      if (drawerDiscountLabel) drawerDiscountLabel.textContent = `Discount (${appliedPromo.code})`;
      if (drawerDiscountVal) drawerDiscountVal.textContent = `-${formatCartMoney(discount)}`;
    } else {
      drawerDiscountRow.style.display = "none";
    }
  }

  // Update Shipping Progress
  const afterDiscount = getSubtotalAfterDiscount();
  const isFreeShip = afterDiscount >= threshold || appliedPromo.freeShip;
  
  const updateProgress = (textEl, fillEl) => {
    if (!textEl || !fillEl) return;
    if (isFreeShip) {
      textEl.innerHTML = "<strong>Congrats!</strong> You've unlocked FREE shipping";
      fillEl.style.width = "100%";
      fillEl.style.background = "#00c882";
    } else {
      const remaining = threshold - afterDiscount;
      textEl.innerHTML = `Add <strong>${formatCartMoney(remaining)}</strong> more for FREE shipping`;
      const pct = Math.min(100, (afterDiscount / threshold) * 100);
      fillEl.style.width = `${pct}%`;
      fillEl.style.background = "linear-gradient(90deg, #3d5eff, #6c63ff)";
    }
  };

  updateProgress(drawerShippingText, drawerShippingFill);
  updateProgress(pageShippingText, pageShippingFill);

  // Handle Empty States
  if (!cart.length) {
    if (container) container.style.display = "none";
    if (empty) empty.style.display = "block";
    if (drawerContainer) drawerContainer.innerHTML = "";
    if (drawerEmpty) drawerEmpty.style.display = "flex";

    const recContainer = document.getElementById("drawer-recommendations-container");
    if (recContainer) recContainer.style.display = "none";

    const trendingList = document.getElementById("drawer-trending-list");
    if (trendingList) {
      const trending = getCartRecommendations(2); // Use same logic for now
      trendingList.innerHTML = trending.map(renderRecCard).join("");
    }
    
    if (summaryRows) {
      summaryRows.innerHTML = `
        <div class="summary-row"><span>Subtotal</span><span>${formatCartMoney(0)}</span></div>
        <div class="summary-row"><span>Shipping</span><span>${formatCartMoney(0)}</span></div>
        <div class="summary-row"><span>Estimated tax</span><span>${formatCartMoney(0)}</span></div>
      `;
    }
    if (totalEl) totalEl.textContent = formatCartMoney(0);
    if (promoHint) promoHint.textContent = "Add items to your cart to apply a promo code.";
    if (promoInput) {
      promoInput.disabled = true;
      promoInput.value = "";
    }
    return;
  }

  if (container) container.style.display = "flex";
  if (empty) empty.style.display = "none";
  if (drawerEmpty) drawerEmpty.style.display = "none";

  // Render Drawer Recommendations
  const recContainer = document.getElementById("drawer-recommendations-container");
  const recList = document.getElementById("drawer-rec-list");
  if (recContainer && recList) {
    const recs = getCartRecommendations(3);
    if (recs.length > 0) {
      recContainer.style.display = "block";
      recList.innerHTML = recs.map(renderRecCard).join("");
    } else {
      recContainer.style.display = "none";
    }
    // Full Page Recommendations
    if (pageRecList && pageRecContainer) {
      const recs = getCartRecommendations(4);
      if (recs.length > 0) {
        pageRecContainer.style.display = "block";
        pageRecList.innerHTML = recs.map((p) => renderRecCard(p)).join("");
      } else {
        pageRecContainer.style.display = "none";
      }
    }
  }

  const cartHtml = cart
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
            <div class="desc">${escapeCartHtml(truncateStorefrontText(item.desc, 40))}</div>
            <div class="qty-control">
              <button type="button" class="qty-btn" onclick="changeQty('${safeId}', -1)"><svg class="icon" aria-hidden="true"><use xlink:href="#icon-minus"></use></svg></button>
              <span class="qty-val">${item.qty}</span>
              <button type="button" class="qty-btn" onclick="changeQty('${safeId}', 1)"><svg class="icon" aria-hidden="true"><use xlink:href="#icon-plus"></use></svg></button>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
            <div class="cart-item-price">${formatCartMoney(item.price * item.qty)}</div>
            <button type="button" class="remove-btn" onclick="removeFromCart('${safeId}')"><svg class="icon" style="width:14px;height:14px;"><use xlink:href="#icon-cross"></use></svg></button>
          </div>
        </div>
      `;
    })
    .join("");

  if (container) container.innerHTML = cartHtml;
  if (drawerContainer) drawerContainer.innerHTML = cartHtml;

  const shipping = getShipping();
  const loyalty = typeof getCurrentLoyaltyState === "function"
    ? getCurrentLoyaltyState(typeof getStoredUser === "function" ? getStoredUser() : null)
    : null;
  const shippingLabel = loyalty?.freeShippingEligible
    ? `(included with ${escapeCartHtml(loyalty.tierName || "loyalty")})`
    : getSubtotalAfterDiscount() < threshold && !appliedPromo.freeShip
      ? `(free over ${formatCartMoney(threshold)})`
      : "";
  const discountLine =
    appliedPromo.code && discount > 0
      ? `<div class="summary-row discount"><span>Discount (${escapeCartHtml(appliedPromo.code)})</span><span>-${formatCartMoney(discount)}</span></div>`
      : "";

  if (summaryRows) {
    summaryRows.innerHTML = `
      <div class="summary-row">
        <span>Subtotal (${getTotalItems()} items)</span>
        <span>${formatCartMoney(subtotal)}</span>
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
  }

  if (totalEl) totalEl.textContent = formatCartMoney(total);
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
