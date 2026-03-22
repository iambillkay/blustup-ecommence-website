// ─────────────────────────────────────
// checkout.js — Checkout summary + validation (demo)
// ─────────────────────────────────────

function readCheckoutField(id) {
  const el = document.getElementById(id);
  return el ? String(el.value || "").trim() : "";
}

function cardDigitsOnly(s) {
  return s.replace(/\D/g, "");
}

function renderCheckout() {
  const miniCart = document.getElementById("checkout-mini-cart");
  const summaryRows = document.getElementById("checkout-summary-rows");
  const totalEl = document.getElementById("checkout-total-display");
  if (!miniCart || !summaryRows || !totalEl) return;

  miniCart.innerHTML = cart
    .map(
      (item) => `
    <div class="mini-cart-item">
      <div class="mini-cart-thumb">
        ${
          item.imageUrl
            ? `<img src="${item.imageUrl}" alt="">`
            : `<div class="mini-cart-icon" style="background:${item.color}">${item.icon || "◆"}</div>`
        }
      </div>
      <div class="mini-cart-info">
        <div class="n">${item.name}</div>
        <div class="q">Qty: ${item.qty}</div>
      </div>
      <div class="mini-cart-price">$${(item.price * item.qty).toFixed(2)}</div>
    </div>
  `
    )
    .join("");

  const disc = typeof getDiscount === "function" ? getDiscount() : 0;
  const ship = typeof getShipping === "function" ? getShipping() : 0;
  const tax = typeof getTax === "function" ? getTax() : 0;
  const sub = typeof getSubtotal === "function" ? getSubtotal() : 0;

  const promoLine =
    disc > 0
      ? `<div class="summary-row discount"><span>Discount</span><span>−$${disc.toFixed(2)}</span></div>`
      : "";

  summaryRows.innerHTML = `
    <div class="summary-row">
      <span>Subtotal</span>
      <span>$${sub.toFixed(2)}</span>
    </div>
    ${promoLine}
    <div class="summary-row">
      <span>Shipping</span>
      <span>${ship === 0 ? "FREE" : "$" + ship.toFixed(2)}</span>
    </div>
    <div class="summary-row">
      <span>Tax (8%)</span>
      <span>$${tax.toFixed(2)}</span>
    </div>
  `;
  totalEl.textContent = "$" + (typeof getTotal === "function" ? getTotal() : 0).toFixed(2);
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
  if (phone.length < 8) return "Please enter a valid phone number.";
  if (!street || !city || !zip) return "Please complete your billing address.";
  return null;
}

function validatePaymentFields() {
  if (getPaymentMethod() === "cod") return null;
  const name = readCheckoutField("co-card-name");
  const num = cardDigitsOnly(readCheckoutField("co-card-number"));
  const expDigits = readCheckoutField("co-card-exp").replace(/\D/g, "");
  const cvv = readCheckoutField("co-card-cvv");

  if (!name) return "Enter the name on card.";
  if (num.length < 15 || num.length > 19) return "Enter a valid card number.";
  if (expDigits.length !== 4) return "Enter expiry as MM / YY (4 digits).";
  const mm = parseInt(expDigits.slice(0, 2), 10);
  if (mm < 1 || mm > 12) return "Enter a valid expiry month (01–12).";
  if (cvv.length < 3) return "Enter the card security code.";
  return null;
}

function placeOrder() {
  if (!cart.length) {
    showToast("!", "Your cart is empty");
    showPage("shop");
    return;
  }
  const err = validateCheckoutForm() || validatePaymentFields();
  if (err) {
    showToast("!", err);
    return;
  }

  const ref = "BLU-" + Date.now().toString(36).toUpperCase() + "-" + Math.floor(1000 + Math.random() * 9000);
  const snapshot = {
    ref,
    at: new Date().toISOString(),
    total: typeof getTotal === "function" ? getTotal() : 0,
    email: readCheckoutField("co-email"),
  };
  try {
    sessionStorage.setItem("blustup_last_order", JSON.stringify(snapshot));
  } catch (_e) {}

  document.getElementById("order-ref").textContent = ref;
  if (typeof resetCartState === "function") resetCartState();
  else {
    try {
      localStorage.removeItem("blustup_cart_v2");
      localStorage.removeItem("blustup_cart_promo");
    } catch (_e) {}
  }
  showPage("success");
}

document.addEventListener("click", (e) => {
  const t = e.target;
  if (t && t.classList && t.classList.contains("pay-icon")) {
    document.querySelectorAll(".pay-icon").forEach((el) => el.classList.remove("active"));
    t.classList.add("active");
  }
});
