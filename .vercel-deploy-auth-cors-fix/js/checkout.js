const CHECKOUT_CURRENCY_SYMBOL = "\u20B5";
const checkoutMoneyFormatter = new Intl.NumberFormat("en-GH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

let checkoutProfilePromise = null;
let checkoutProfileLoaded = false;

function formatCheckoutMoney(value) {
  const amount = Number(value || 0);
  return `${CHECKOUT_CURRENCY_SYMBOL}${checkoutMoneyFormatter.format(Number.isFinite(amount) ? amount : 0)}`;
}

function readCheckoutField(id) {
  const el = document.getElementById(id);
  return el ? String(el.value || "").trim() : "";
}

function fillCheckoutField(id, value, force = false) {
  const el = document.getElementById(id);
  if (!el || value == null || value === "") return;
  if (!force && String(el.value || "").trim()) return;
  el.value = String(value);
}

function cardDigitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function getCheckoutCatalog() {
  if (Array.isArray(allProducts) && allProducts.length) return allProducts;
  if (Array.isArray(products) && products.length) return products;
  return [];
}

function findCheckoutProductById(id) {
  const productId = String(id);
  return getCheckoutCatalog().find((product) => String(product?.id) === productId) || null;
}

function getCheckoutProductCategories(product) {
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

function buildCheckoutCartItem(product, qty) {
  const categories = getCheckoutProductCategories(product);
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

function getCheckoutLoyaltyState() {
  if (typeof getCurrentLoyaltyState === "function") {
    return getCurrentLoyaltyState(getCheckoutStoredUser());
  }
  return null;
}

function getEstimatedCheckoutPoints(totalValue) {
  const user = getCheckoutStoredUser();
  if (!user?.email) return 0;
  const total = Math.max(0, Number(totalValue || 0));
  if (total <= 0) return 0;
  return Math.max(1, Math.floor(total / 5));
}

function syncCheckoutLoyaltyNote(totalValue) {
  const node = document.getElementById("checkout-loyalty-note");
  if (!node) return;

  const user = getCheckoutStoredUser();
  const loyalty = getCheckoutLoyaltyState();
  const estimatedPoints = getEstimatedCheckoutPoints(totalValue);
  const hasCheckoutValue = Math.max(0, Number(totalValue || 0)) > 0;

  if (!user?.email) {
    node.innerHTML = `Sign in before payment to earn loyalty points and unlock free shipping once you reach Silver.`;
    return;
  }

  if (!hasCheckoutValue) {
    node.innerHTML = loyalty?.freeShippingEligible
      ? `${escapeCheckoutHtml(loyalty.tierName || "Loyalty")} perk active: free shipping is already unlocked for your next order.`
      : `${escapeCheckoutHtml(loyalty?.highlight || "Your loyalty points will start growing on the next signed-in purchase.")}`;
    return;
  }

  if (loyalty?.freeShippingEligible) {
    node.innerHTML = `${escapeCheckoutHtml(loyalty.tierName || "Loyalty")} perk active: free shipping is already unlocked. This order adds <strong>+${escapeCheckoutHtml(estimatedPoints)}</strong> points.`;
    return;
  }

  const nextTierCopy = loyalty?.nextTierName
    ? `${escapeCheckoutHtml(loyalty.pointsToNextTier)} more points to reach ${escapeCheckoutHtml(loyalty.nextTierName)}.`
    : `You have already reached the highest loyalty tier.`;

  node.innerHTML = `You will earn <strong>+${escapeCheckoutHtml(estimatedPoints)}</strong> points from this order. ${nextTierCopy}`;
}

function escapeCheckoutHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getPaymentMethod() {
  const active = document.querySelector(".pay-icon.active");
  return active?.getAttribute("data-method") || "card";
}
window.getPaymentMethod = getPaymentMethod;

function syncPaymentFields() {
  const method = getPaymentMethod();
  const cardFields = document.getElementById("checkout-card-fields");
  const placeOrderButton = document.getElementById("placeOrderBtn");

  if (cardFields) cardFields.hidden = method !== "card";
  if (placeOrderButton) {
    placeOrderButton.textContent =
      method === "card" ? "Place Order & Pay" : method === "cod" ? "Place Order" : "Continue";
  }
}

function formatCardNumberInput() {
  const input = document.getElementById("co-card-number");
  if (!input) return;
  const digits = cardDigitsOnly(input.value).slice(0, 19);
  input.value = digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function formatExpiryInput() {
  const input = document.getElementById("co-card-exp");
  if (!input) return;
  const digits = cardDigitsOnly(input.value).slice(0, 4);
  if (digits.length <= 2) {
    input.value = digits;
    return;
  }
  input.value = `${digits.slice(0, 2)} / ${digits.slice(2)}`;
}

function getCheckoutStoredUser() {
  if (typeof getStoredUser === "function") return getStoredUser();
  try {
    return JSON.parse(localStorage.getItem("blustup_user") || sessionStorage.getItem("blustup_user") || "null");
  } catch (_e) {
    return null;
  }
}

function splitCheckoutName(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function renderCheckoutAccountHint(user) {
  const hint = document.getElementById("checkout-account-hint");
  if (!hint) return;

  if (!user) {
    hint.hidden = true;
    hint.textContent = "";
    return;
  }

  hint.hidden = false;
  hint.textContent = `Signed in as ${user.email}. We filled the billing details we already have for your account.`;
}

function applyCheckoutProfile(user, options = {}) {
  if (!user) {
    renderCheckoutAccountHint(null);
    return;
  }

  const force = options.force === true;
  const billingProfile = user.billingProfile || {};
  const splitName = splitCheckoutName(user.name);

  fillCheckoutField("co-first", billingProfile.firstName || splitName.firstName, force);
  fillCheckoutField("co-last", billingProfile.lastName || splitName.lastName, force);
  fillCheckoutField("co-email", user.email || "", force);
  fillCheckoutField("co-phone", user.phone || "", force);
  fillCheckoutField("co-street", billingProfile.street || "", force);
  fillCheckoutField("co-city", billingProfile.city || "", force);
  fillCheckoutField("co-state", billingProfile.state || "", force);
  fillCheckoutField("co-zip", billingProfile.zip || "", force);
  fillCheckoutField("co-country", billingProfile.country || "", force);
  renderCheckoutAccountHint(user);
}

async function hydrateCheckoutProfile(force = false) {
  const token = typeof getToken === "function" ? getToken() : null;
  const storedUser = getCheckoutStoredUser();

  if (!token) {
    checkoutProfileLoaded = true;
    renderCheckoutAccountHint(null);
    return null;
  }

  if (storedUser) applyCheckoutProfile(storedUser, { force });
  if (checkoutProfileLoaded && !force) return storedUser;
  if (checkoutProfilePromise && !force) return checkoutProfilePromise;

  checkoutProfilePromise = (async () => {
    try {
      if (typeof api !== "function") return storedUser;
      const { user } = await api("/api/auth/me");
      if (user && typeof persistStoredUser === "function") persistStoredUser(user);
      if (user) applyCheckoutProfile(user, { force });
      checkoutProfileLoaded = true;
      return user || storedUser;
    } catch (_e) {
      checkoutProfileLoaded = true;
      return storedUser;
    } finally {
      checkoutProfilePromise = null;
    }
  })();

  return checkoutProfilePromise;
}

function renderCheckout() {
  const miniCart = document.getElementById("checkout-mini-cart");
  const summaryRows = document.getElementById("checkout-summary-rows");
  const totalEl = document.getElementById("checkout-total-display");
  if (!miniCart || !summaryRows || !totalEl) return;

  hydrateCheckoutProfile(false);

  if (!Array.isArray(cart) || !cart.length) {
    miniCart.innerHTML = `<p class="promo-hint">Your cart is empty. Add items before checking out.</p>`;
    summaryRows.innerHTML = `
      <div class="summary-row">
        <span>Subtotal</span>
        <span>${formatCheckoutMoney(0)}</span>
      </div>
      <div class="summary-row">
        <span>Shipping</span>
        <span>${formatCheckoutMoney(0)}</span>
      </div>
      <div class="summary-row">
        <span>Tax (8%)</span>
        <span>${formatCheckoutMoney(0)}</span>
      </div>
    `;
    totalEl.textContent = formatCheckoutMoney(0);
    syncCheckoutLoyaltyNote(0);
    syncPaymentFields();
    return;
  }

  miniCart.innerHTML = cart
    .map((item) => {
      const thumb = item.imageUrl
        ? `<img src="${escapeCheckoutHtml(item.imageUrl)}" alt="${escapeCheckoutHtml(item.name)}">`
        : `<div class="mini-cart-icon" style="background:${escapeCheckoutHtml(item.color || "#e8ebff")}">${escapeCheckoutHtml(item.icon || "*")}</div>`;

      return `
        <div class="mini-cart-item">
          <div class="mini-cart-thumb">${thumb}</div>
          <div class="mini-cart-info">
            <div class="n">${escapeCheckoutHtml(item.name)}</div>
            <div class="q">Qty: ${item.qty}</div>
          </div>
          <div class="mini-cart-price">${formatCheckoutMoney(item.price * item.qty)}</div>
        </div>
      `;
    })
    .join("");

  const discount = typeof getDiscount === "function" ? getDiscount() : 0;
  const shipping = typeof getShipping === "function" ? getShipping() : 0;
  const tax = typeof getTax === "function" ? getTax() : 0;
  const subtotal = typeof getSubtotal === "function" ? getSubtotal() : 0;
  const total = typeof getTotal === "function" ? getTotal() : 0;
  const estimatedPoints = getEstimatedCheckoutPoints(total);

  summaryRows.innerHTML = `
    <div class="summary-row">
      <span>Subtotal</span>
      <span>${formatCheckoutMoney(subtotal)}</span>
    </div>
    ${
      discount > 0
        ? `<div class="summary-row discount"><span>Discount</span><span>-${formatCheckoutMoney(discount)}</span></div>`
        : ""
    }
    <div class="summary-row">
      <span>Shipping</span>
      <span>${shipping === 0 ? "FREE" : formatCheckoutMoney(shipping)}</span>
    </div>
    <div class="summary-row">
      <span>Tax (8%)</span>
      <span>${formatCheckoutMoney(tax)}</span>
    </div>
    ${
      estimatedPoints > 0
        ? `<div class="summary-row loyalty"><span>Loyalty points</span><span>+${escapeCheckoutHtml(estimatedPoints)}</span></div>`
        : ""
    }
  `;

  totalEl.textContent = formatCheckoutMoney(total);
  syncCheckoutLoyaltyNote(total);
  syncPaymentFields();
}

function validateCheckoutForm() {
  const first = readCheckoutField("co-first");
  const last = readCheckoutField("co-last");
  const email = readCheckoutField("co-email");
  const phone = readCheckoutField("co-phone");
  const street = readCheckoutField("co-street");
  const city = readCheckoutField("co-city");
  const state = readCheckoutField("co-state");
  const zip = readCheckoutField("co-zip");
  const country = readCheckoutField("co-country");

  if (!first || !last) return "Please enter your first and last name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Please enter a valid email address.";
  if (cardDigitsOnly(phone).length < 8) return "Please enter a valid phone number.";
  if (!street || !city || !state || !zip || !country) return "Please complete your billing address.";
  return null;
}

function validatePaymentFields() {
  const method = getPaymentMethod();
  if (method !== "card") return null;

  const name = readCheckoutField("co-card-name");
  const number = cardDigitsOnly(readCheckoutField("co-card-number"));
  const expiryDigits = cardDigitsOnly(readCheckoutField("co-card-exp"));
  const cvv = cardDigitsOnly(readCheckoutField("co-card-cvv"));

  if (!name) return "Enter the name on the card.";
  if (number.length < 15 || number.length > 19) return "Enter a valid card number.";
  if (expiryDigits.length !== 4) return "Enter expiry as MM / YY.";

  const month = Number(expiryDigits.slice(0, 2));
  if (month < 1 || month > 12) return "Enter a valid expiry month (01-12).";
  if (cvv.length < 3) return "Enter the card security code.";

  return null;
}

function buildCheckoutPayload() {
  return {
    sessionId: window.tracker?.sessionId || null,
    paymentMethod: getPaymentMethod(),
    promoCode: typeof appliedPromo === "object" ? appliedPromo.code || null : null,
    customer: {
      firstName: readCheckoutField("co-first"),
      lastName: readCheckoutField("co-last"),
      email: readCheckoutField("co-email"),
      phone: readCheckoutField("co-phone"),
    },
    billingAddress: {
      street: readCheckoutField("co-street"),
      city: readCheckoutField("co-city"),
      state: readCheckoutField("co-state"),
      zip: readCheckoutField("co-zip"),
      country: readCheckoutField("co-country"),
    },
    items: cart.map((item) => ({
      productId: String(item.id),
      qty: Math.max(1, Number(item.qty) || 1),
    })),
  };
}

function describeCheckoutCartRefresh(removedItems, adjustedItems) {
  const parts = [];

  if (removedItems.length) {
    parts.push(
      removedItems.length === 1
        ? `${removedItems[0]} is no longer available.`
        : "Some items in your cart are no longer available."
    );
  }

  if (adjustedItems.length) {
    parts.push(
      adjustedItems.length === 1
        ? `${adjustedItems[0]} was updated to match current stock.`
        : "Some item quantities were updated to match current stock."
    );
  }

  return `${parts.join(" ")} Review your cart and place the order again.`.trim();
}

async function refreshCheckoutCartBeforeSubmit() {
  if (typeof loadProducts === "function") {
    try {
      await loadProducts({ force: true });
    } catch (_e) {
      // Keep going with the last known catalog snapshot if refresh fails.
    }
  }

  if (!Array.isArray(cart) || !cart.length) {
    return { ok: false, message: "Your cart is empty." };
  }

  const removedItems = [];
  const adjustedItems = [];
  const nextCart = [];

  for (const item of cart) {
    const product = findCheckoutProductById(item.id);
    if (!product || product.isActive === false) {
      removedItems.push(item.name || "This item");
      continue;
    }

    const stockQty = Math.max(0, Number(product.stockQty || 0));
    if (stockQty <= 0) {
      removedItems.push(product.name || item.name || "This item");
      continue;
    }

    const nextQty = Math.min(Math.max(1, Number(item.qty) || 1), stockQty);
    if (nextQty !== Math.max(1, Number(item.qty) || 1)) {
      adjustedItems.push(product.name || item.name || "This item");
    }

    nextCart.push(buildCheckoutCartItem(product, nextQty));
  }

  const cartChanged =
    nextCart.length !== cart.length
    || nextCart.some((item, index) => {
      const previous = cart[index];
      return (
        !previous
        || String(previous.id) !== String(item.id)
        || Number(previous.qty || 0) !== Number(item.qty || 0)
        || Number(previous.price || 0) !== Number(item.price || 0)
        || String(previous.name || "") !== String(item.name || "")
      );
    });

  if (cartChanged) {
    cart = nextCart;
    if (typeof saveCartToStorage === "function") saveCartToStorage();
    if (typeof updateCartCount === "function") updateCartCount();
    if (typeof renderCart === "function") renderCart();
    renderCheckout();
  }

  if (!cart.length) {
    return {
      ok: false,
      message: removedItems.length
        ? "Your cart was refreshed because those items are no longer available."
        : "Your cart is empty.",
    };
  }

  if (removedItems.length || adjustedItems.length) {
    return { ok: false, message: describeCheckoutCartRefresh(removedItems, adjustedItems) };
  }

  return { ok: true };
}

function setPlaceOrderSubmitting(submitting) {
  const button = document.getElementById("placeOrderBtn");
  if (!button) return;
  button.disabled = submitting;
  button.setAttribute("aria-busy", String(submitting));
  if (!submitting) {
    syncPaymentFields();
    return;
  }
  button.textContent = "Processing order...";
}

async function placeOrder() {
  if (!Array.isArray(cart) || !cart.length) {
    showToast("!", "Your cart is empty");
    showPage("shop");
    return;
  }

  const cartRefresh = await refreshCheckoutCartBeforeSubmit();
  if (!cartRefresh.ok) {
    showToast("!", cartRefresh.message || "Please review your cart before placing the order.");
    if (!Array.isArray(cart) || !cart.length) showPage("cart");
    return;
  }

  const error = validateCheckoutForm() || validatePaymentFields();
  if (error) {
    showToast("!", error);
    return;
  }

  setPlaceOrderSubmitting(true);

  try {
    const payload = buildCheckoutPayload();
    const response = typeof api === "function"
      ? await api("/api/orders", { method: "POST", body: JSON.stringify(payload) })
      : await fetch(typeof buildApiUrl === "function" ? buildApiUrl("/api/orders") : "/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || "Failed to place your order.");
          return data;
        });

    const order = response.order;
    if (!order) throw new Error("Order confirmation was incomplete.");

    const snapshot = {
      ref: order.reference,
      at: order.createdAt || new Date().toISOString(),
      total: Number(order.total || 0),
      email: order.customerEmail,
      method: order.paymentMethod,
      status: order.status,
      loyaltyEarned: Number(response.loyaltyEarned || 0),
      loyaltyBalanceAfter: Number(order.loyaltyBalanceAfter || response.loyalty?.points || 0),
      loyaltyTierAfter: order.loyaltyTierAfter || response.loyalty?.tierName || null,
    };

    try {
      sessionStorage.setItem("blustup_last_order", JSON.stringify(snapshot));
    } catch (_e) {}

    if (response.user && typeof persistStoredUser === "function") {
      persistStoredUser(response.user);
    }

    const orderRef = document.getElementById("order-ref");
    if (orderRef) orderRef.textContent = order.reference;
    const successLoyalty = document.getElementById("success-loyalty-note");
    if (successLoyalty) {
      if (response.loyaltyEarned > 0) {
        const balanceAfter = Number(order.loyaltyBalanceAfter || response.loyalty?.points || 0);
        const tierAfter = order.loyaltyTierAfter || response.loyalty?.tierName || "";
        successLoyalty.textContent = balanceAfter > 0 && tierAfter
          ? `You earned ${response.loyaltyEarned} loyalty points from this order. Your balance is now ${balanceAfter} points in ${tierAfter}.`
          : `You earned ${response.loyaltyEarned} loyalty points from this order.`;
        successLoyalty.hidden = false;
      } else {
        successLoyalty.hidden = true;
        successLoyalty.textContent = "";
      }
    }

    if (typeof resetCartState === "function") {
      resetCartState();
    } else {
      try {
        localStorage.removeItem("blustup_cart_v2");
        localStorage.removeItem("blustup_cart_promo");
      } catch (_e) {}
    }

    renderCheckout();
    if (typeof refreshOrdersPage === "function") refreshOrdersPage();
    showPage("success");
  } catch (requestError) {
    showToast("!", requestError.message || "Failed to place your order.");
  } finally {
    setPlaceOrderSubmitting(false);
  }
}

window.placeOrder = placeOrder;

document.addEventListener("click", (event) => {
  const button = event.target.closest(".pay-icon");
  if (!button) return;

  document.querySelectorAll(".pay-icon").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  syncPaymentFields();
});

document.addEventListener("DOMContentLoaded", () => {
  syncPaymentFields();
  hydrateCheckoutProfile(false);

  document.getElementById("co-card-number")?.addEventListener("input", formatCardNumberInput);
  document.getElementById("co-card-exp")?.addEventListener("input", formatExpiryInput);
});
