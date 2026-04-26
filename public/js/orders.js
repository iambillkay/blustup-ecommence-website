const ORDER_CURRENCY_SYMBOL = "\u20B5";
const orderMoneyFormatter = new Intl.NumberFormat("en-GH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const ORDER_TRACKING_STEPS = ["placed", "processing", "shipped", "delivered"];
const ORDER_PAYMENT_LABELS = {
  card: "Card",
  cod: "Pay on delivery",
  paypal: "PayPal",
  apple: "Apple Pay",
  google: "Google Pay",
};

function formatOrderMoney(value) {
  const amount = Number(value || 0);
  return `${ORDER_CURRENCY_SYMBOL}${orderMoneyFormatter.format(Number.isFinite(amount) ? amount : 0)}`;
}

function escapeOrdersHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatOrderDate(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return "Just now";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function humanizeOrderStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (!value) return "Pending";
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function getOrderStatusTone(status) {
  const value = String(status || "").trim().toLowerCase();
  if (value === "delivered") return "is-delivered";
  if (value === "shipped") return "is-shipped";
  if (value === "processing") return "is-processing";
  if (value === "cancelled") return "is-cancelled";
  return "is-placed";
}

function humanizePaymentMethod(method) {
  const value = String(method || "").trim().toLowerCase();
  return ORDER_PAYMENT_LABELS[value] || humanizeOrderStatus(value || "card");
}

function getLatestOrderUpdate(order) {
  const history = Array.isArray(order?.statusHistory) ? order.statusHistory : [];
  return history.length ? history[history.length - 1] : null;
}

function getOrderTrackingSummary(order) {
  const status = String(order?.status || "").trim().toLowerCase();
  const currentIndex = ORDER_TRACKING_STEPS.indexOf(status);
  return {
    status,
    isCancelled: status === "cancelled",
    completedIndex: currentIndex >= 0 ? currentIndex : 0,
  };
}

function renderOrderTrackingProgress(order) {
  const tracking = getOrderTrackingSummary(order);
  const latestUpdate = getLatestOrderUpdate(order);

  if (tracking.isCancelled) {
    return `
      <div class="order-tracking-alert is-cancelled">
        <strong>Order cancelled</strong>
        <span>${escapeOrdersHtml(latestUpdate?.note || "This order will not continue through fulfillment.")}</span>
      </div>
    `;
  }

  return `
    <div class="order-progress-steps" aria-label="Order progress">
      ${ORDER_TRACKING_STEPS.map((step, index) => `
        <div class="order-progress-step ${tracking.completedIndex > index ? "is-complete" : ""} ${tracking.completedIndex === index ? "is-current" : ""}">
          <div class="order-progress-dot">${tracking.completedIndex > index ? '<svg class="icon" aria-hidden="true"><use xlink:href="#icon-check"></use></svg>' : index + 1}</div>
          <div class="order-progress-copy">
            <strong>${escapeOrdersHtml(humanizeOrderStatus(step))}</strong>
            <span>${escapeOrdersHtml(
              step === "placed"
                ? "Order received"
                : step === "processing"
                  ? "Preparing items"
                  : step === "shipped"
                    ? "On the way"
                    : "Completed"
            )}</span>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderOrderHighlights(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const latestUpdate = getLatestOrderUpdate(order);
  const highlights = [
    { label: "Payment", value: humanizePaymentMethod(order?.paymentMethod) },
    { label: "Items", value: `${items.reduce((sum, item) => sum + Number(item.qty || 0), 0)} item(s)` },
    latestUpdate?.note ? { label: "Latest update", value: latestUpdate.note } : null,
    order?.promoLabel ? { label: "Promo", value: order.promoLabel } : null,
    Number(order?.loyaltyEarned || 0) > 0 ? { label: "Points earned", value: `+${Math.floor(Number(order.loyaltyEarned || 0))} pts` } : null,
  ].filter(Boolean);

  if (!highlights.length) return "";

  return `
    <div class="order-highlights">
      ${highlights.map((highlight) => `
        <div class="order-highlight-chip">
          <strong>${escapeOrdersHtml(highlight.label)}</strong>
          <span>${escapeOrdersHtml(highlight.value)}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function readLastOrderSnapshot() {
  try {
    return JSON.parse(sessionStorage.getItem("blustup_last_order") || "null");
  } catch (_e) {
    return null;
  }
}

function setOrdersAccountState(html) {
  const node = document.getElementById("ordersAccountState");
  if (node) node.innerHTML = html;
}

function setOrdersResultsTitle(title, copy) {
  const titleNode = document.getElementById("ordersResultsTitle");
  const copyNode = document.getElementById("ordersResultsCopy");
  if (titleNode !== null) titleNode.textContent = title;
  if (copyNode !== null) copyNode.textContent = copy;
}

function setOrdersResultsHtml(html) {
  const node = document.getElementById("ordersResults");
  if (node) node.innerHTML = html;
}

function renderOrdersEmpty(message) {
  setOrdersResultsHtml(`<div class="orders-empty">${escapeOrdersHtml(message)}</div>`);
}

function renderStatusTimeline(history = []) {
  const entries = Array.isArray(history) ? history : [];
  if (!entries.length) return "";

  return `
    <div class="order-timeline">
      ${entries.map((entry) => `
        <div class="order-timeline-row">
          <div class="order-timeline-dot"></div>
          <div>
            <div class="order-timeline-title">${escapeOrdersHtml(humanizeOrderStatus(entry.status))}</div>
            <div class="order-timeline-copy">${escapeOrdersHtml(entry.note || "Status updated")}</div>
            <div class="order-timeline-time">${escapeOrdersHtml(formatOrderDate(entry.createdAt))}</div>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderOrderCard(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const latestUpdate = getLatestOrderUpdate(order);
  return `
    <article class="order-card">
      <div class="order-card-top">
        <div>
          <div class="order-card-ref">${escapeOrdersHtml(order.reference || "Order")}</div>
          <div class="order-card-meta">Placed ${escapeOrdersHtml(formatOrderDate(order.createdAt))}${latestUpdate?.createdAt ? ` · Updated ${escapeOrdersHtml(formatOrderDate(latestUpdate.createdAt))}` : ""}</div>
        </div>
        <span class="order-status ${getOrderStatusTone(order.status)}">${escapeOrdersHtml(humanizeOrderStatus(order.status))}</span>
      </div>

      ${renderOrderTrackingProgress(order)}
      ${renderOrderHighlights(order)}

      <div class="order-card-grid">
        <div>
          <div class="order-card-label">Items</div>
          <div class="order-items-list">
            ${items.map((item) => `
              <div class="order-item-row">
                <div class="order-item-copy">
                  <strong>${escapeOrdersHtml(item.name)}</strong>
                  <span>Qty ${escapeOrdersHtml(item.qty)} · ${escapeOrdersHtml(formatOrderMoney(item.price))}</span>
                </div>
                <span>${escapeOrdersHtml(formatOrderMoney(Number(item.price || 0) * Number(item.qty || 0)))}</span>
              </div>
            `).join("")}
          </div>
        </div>

        <div>
          <div class="order-card-label">Billing</div>
          <div class="order-billing-copy">
            ${escapeOrdersHtml(order.customerName || "")}<br>
            ${escapeOrdersHtml(order.customerEmail || "")}<br>
            ${escapeOrdersHtml(order.customerPhone || "")}
          </div>
          <div class="order-billing-address">
            ${escapeOrdersHtml(order.billingAddress?.street || "")}<br>
            ${escapeOrdersHtml(order.billingAddress?.city || "")}, ${escapeOrdersHtml(order.billingAddress?.state || "")} ${escapeOrdersHtml(order.billingAddress?.zip || "")}<br>
            ${escapeOrdersHtml(order.billingAddress?.country || "")}
          </div>
        </div>
      </div>

      <div class="order-totals">
        <div><span>Subtotal</span><strong>${escapeOrdersHtml(formatOrderMoney(order.subtotal))}</strong></div>
        <div><span>Discount</span><strong>${escapeOrdersHtml(formatOrderMoney(order.discount))}</strong></div>
        <div><span>Shipping</span><strong>${escapeOrdersHtml(formatOrderMoney(order.shipping))}</strong></div>
        <div><span>Tax</span><strong>${escapeOrdersHtml(formatOrderMoney(order.tax))}</strong></div>
        ${
          Number(order.loyaltyEarned || 0) > 0
            ? `<div><span>Points earned</span><strong>+${escapeOrdersHtml(String(Math.floor(Number(order.loyaltyEarned || 0))))} pts</strong></div>`
            : ""
        }
        ${
          Number(order.loyaltyBalanceAfter || 0) > 0
            ? `<div><span>Balance after order</span><strong>${escapeOrdersHtml(String(Math.floor(Number(order.loyaltyBalanceAfter || 0))))} pts${order.loyaltyTierAfter ? ` · ${escapeOrdersHtml(order.loyaltyTierAfter)}` : ""}</strong></div>`
            : ""
        }
        <div class="order-total-row"><span>Total</span><strong>${escapeOrdersHtml(formatOrderMoney(order.total))}</strong></div>
      </div>

      ${renderStatusTimeline(order.statusHistory)}
    </article>
  `;
}

function prefillGuestLookup(snapshot = readLastOrderSnapshot()) {
  if (!snapshot) return;
  const refInput = document.getElementById("orderLookupRef");
  const emailInput = document.getElementById("orderLookupEmail");
  if (refInput && !String(refInput.value || "").trim()) refInput.value = snapshot.ref || "";
  if (emailInput && !String(emailInput.value || "").trim()) emailInput.value = snapshot.email || "";
}

function renderSignedInAccount(user) {
  const firstName = String(user?.name || "").trim().split(/\s+/)[0] || "shopper";
  const loyalty = typeof getCurrentLoyaltyState === "function" ? getCurrentLoyaltyState(user) : null;
  setOrdersAccountState(`
    <div class="orders-account-card">
      <div class="orders-account-title">Signed in as ${escapeOrdersHtml(user?.email || "")}</div>
      <div class="orders-account-copy">Hi ${escapeOrdersHtml(firstName)}. Your saved orders and the billing details linked to your account stay ready here.</div>
      ${
        loyalty
          ? `
            <div class="orders-account-badges">
              <span class="orders-account-pill">${escapeOrdersHtml(String(loyalty.points || 0))} pts</span>
              <span class="orders-account-pill">${escapeOrdersHtml(loyalty.tierName || "Starter")}</span>
              <span class="orders-account-pill">${escapeOrdersHtml(loyalty.freeShippingEligible ? "Free shipping active" : "Standard shipping")}</span>
            </div>
            <div class="orders-account-copy"><strong>${escapeOrdersHtml(String(loyalty.points || 0))} points</strong> in ${escapeOrdersHtml(loyalty.tierName || "Starter")} tier. ${escapeOrdersHtml(loyalty.highlight || "")}</div>
            <div class="orders-account-copy">${
              loyalty.nextTierName
                ? `${escapeOrdersHtml(String(loyalty.pointsToNextTier || 0))} more points to reach ${escapeOrdersHtml(loyalty.nextTierName)}.`
                : "You have already unlocked the highest loyalty tier."
            }</div>
          `
          : ""
      }
    </div>
  `);
}

function renderSignedOutAccount() {
  setOrdersAccountState(`
    <div class="orders-account-card">
      <div class="orders-account-title">Sign in for full order history</div>
      <div class="orders-account-copy">Guest orders can still be tracked below with your order reference and email.</div>
      <button class="cart-secondary-btn" type="button" onclick="showPage('login')">Sign in</button>
    </div>
  `);
}

async function lookupOrder(reference, email) {
  if (typeof api !== "function") throw new Error("Order lookup is unavailable right now.");
  const query = new URLSearchParams({ reference: String(reference || "").trim(), email: String(email || "").trim() });
  const { order } = await api(`/api/orders/lookup?${query.toString()}`);
  return order;
}

function syncSuccessTrackButton() {
  const button = document.getElementById("successTrackOrderBtn");
  if (button) {
    button.textContent = (typeof getToken === "function" && getToken()) ? "View order updates" : "Track this order";
  }
}

async function refreshOrdersPage() {
  const token = typeof getToken === "function" ? getToken() : null;
  let user = typeof getStoredUser === "function" ? getStoredUser() : null;
  const signOutButton = document.getElementById("ordersSignOutBtn");

  syncSuccessTrackButton();
  prefillGuestLookup();

  if (signOutButton) signOutButton.hidden = !token;

  if (token && !user && typeof api === "function") {
    try {
      const response = await api("/api/auth/me");
      user = response.user || null;
      if (user && typeof persistStoredUser === "function") persistStoredUser(user);
    } catch (_e) {
      user = null;
    }
  }

  if (token && user) {
    renderSignedInAccount(user);
    setOrdersResultsTitle("Your orders", "Live updates for every order linked to your account.");
    setOrdersResultsHtml(`<div class="orders-empty">Loading your orders...</div>`);

    try {
      const { orders } = await api("/api/orders/me");
      if (!Array.isArray(orders) || !orders.length) {
        renderOrdersEmpty("You have not placed any orders yet.");
        return;
      }
      setOrdersResultsHtml(orders.map(renderOrderCard).join(""));
    } catch (error) {
      renderOrdersEmpty(error.message || "We couldn't load your orders right now.");
    }
    return;
  }

  renderSignedOutAccount();
  const snapshot = readLastOrderSnapshot();
  setOrdersResultsTitle("Track a guest order", "Use your order reference and email to see the latest status.");

  if (snapshot?.ref && snapshot?.email) {
    setOrdersResultsHtml(`<div class="orders-empty">Loading your latest tracked order...</div>`);
    try {
      const order = await lookupOrder(snapshot.ref, snapshot.email);
      setOrdersResultsHtml(renderOrderCard(order));
      return;
    } catch (_e) {
      renderOrdersEmpty("Use your order reference and email above to track a guest order.");
      return;
    }
  }

  renderOrdersEmpty("Use your order reference and email above to track a guest order.");
}

window.refreshOrdersPage = refreshOrdersPage;

document.addEventListener("DOMContentLoaded", () => {
  const lookupForm = document.getElementById("orderLookupForm");
  const refreshButton = document.getElementById("ordersRefreshBtn");
  const signOutButton = document.getElementById("ordersSignOutBtn");

  syncSuccessTrackButton();
  prefillGuestLookup();

  lookupForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const reference = document.getElementById("orderLookupRef")?.value.trim() || "";
    const email = document.getElementById("orderLookupEmail")?.value.trim() || "";
    if (!reference || !email) {
      showToast('<svg class="icon" aria-hidden="true"><use xlink:href="#icon-error"></use></svg>', "Enter your order reference and email.");
      return;
    }

    setOrdersResultsTitle("Tracked order", `Showing the latest update for ${reference}.`);
    setOrdersResultsHtml(`<div class="orders-empty">Looking up your order...</div>`);

    try {
      const order = await lookupOrder(reference, email);
      try {
        sessionStorage.setItem("blustup_last_order", JSON.stringify({
          ref: order.reference,
          email: order.customerEmail,
          total: order.total,
          at: order.createdAt,
          method: order.paymentMethod,
          status: order.status,
        }));
      } catch (_e) {}
      setOrdersResultsHtml(renderOrderCard(order));
    } catch (error) {
      renderOrdersEmpty(error.message || "Order not found.");
    }
  });

  refreshButton?.addEventListener("click", () => {
    refreshOrdersPage();
  });

  signOutButton?.addEventListener("click", () => {
    if (typeof logout === "function") logout();
  });
});
