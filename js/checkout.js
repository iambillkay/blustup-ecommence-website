const CHECKOUT_CURRENCY_SYMBOL = "\u20B5";
const checkoutMoneyFormatter = new Intl.NumberFormat("en-GH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCheckoutMoney(value) {
  const amount = Number(value || 0);
  return `${CHECKOUT_CURRENCY_SYMBOL}${checkoutMoneyFormatter.format(Number.isFinite(amount) ? amount : 0)}`;
}

function readCheckoutField(id) {
  const el = document.getElementById(id);
  return el ? String(el.value || "").trim() : "";
}

function cardDigitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
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

function renderCheckout() {
  const miniCart = document.getElementById("checkout-mini-cart");
  const summaryRows = document.getElementById("checkout-summary-rows");
  const totalEl = document.getElementById("checkout-total-display");
  if (!miniCart || !summaryRows || !totalEl) return;

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
  `;

  totalEl.textContent = formatCheckoutMoney(total);
  syncPaymentFields();
}

function validateCheckoutForm() {
  const first = readCheckoutField("co-first");
  const last = readCheckoutField("co-last");
  const email = readCheckoutField("co-email");
  const phone = readCheckoutField("co-phone");
  const street = readCheckoutField("co-street");
  const city = readCheckoutField("co-city");
  const zip = readCheckoutField("co-zip");

  if (!first || !last) return "Please enter your first and last name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Please enter a valid email address.";
  if (cardDigitsOnly(phone).length < 8) return "Please enter a valid phone number.";
  if (!street || !city || !zip) return "Please complete your billing address.";
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

function placeOrder() {
  if (!Array.isArray(cart) || !cart.length) {
    showToast("!", "Your cart is empty");
    showPage("shop");
    return;
  }

  const error = validateCheckoutForm() || validatePaymentFields();
  if (error) {
    showToast("!", error);
    return;
  }

  const ref = `BLU-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const snapshot = {
    ref,
    at: new Date().toISOString(),
    total: typeof getTotal === "function" ? getTotal() : 0,
    email: readCheckoutField("co-email"),
    method: getPaymentMethod(),
  };

  try {
    sessionStorage.setItem("blustup_last_order", JSON.stringify(snapshot));
  } catch (_e) {}

  const orderRef = document.getElementById("order-ref");
  if (orderRef) orderRef.textContent = ref;

  if (typeof resetCartState === "function") {
    resetCartState();
  } else {
    try {
      localStorage.removeItem("blustup_cart_v2");
      localStorage.removeItem("blustup_cart_promo");
    } catch (_e) {}
  }

  renderCheckout();
  showPage("success");
}

document.addEventListener("click", (event) => {
  const button = event.target.closest(".pay-icon");
  if (!button) return;

  document.querySelectorAll(".pay-icon").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  syncPaymentFields();
});

document.addEventListener("DOMContentLoaded", () => {
  syncPaymentFields();

  document.getElementById("co-card-number")?.addEventListener("input", formatCardNumberInput);
  document.getElementById("co-card-exp")?.addEventListener("input", formatExpiryInput);
});
