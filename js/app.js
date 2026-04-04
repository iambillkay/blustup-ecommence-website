// Router, toast, and base app initialization

function syncNavState(pageName) {
  document.querySelectorAll("[data-nav-page]").forEach((link) => {
    link.classList.toggle("active-link", link.getAttribute("data-nav-page") === pageName);
  });
}

async function refreshLivePageData(pageName, options = {}) {
  const activePage = String(pageName || "").trim().toLowerCase();
  const shouldRefreshCatalog = ["home", "shop", "cart", "checkout"].includes(activePage);

  try {
    if (shouldRefreshCatalog && typeof loadProducts === "function") {
      await loadProducts({ force: options?.force === true });
    }

    if (activePage === "home" && typeof loadHomeContent === "function") {
      await loadHomeContent();
      return;
    }

    if (activePage === "shop" && typeof loadShopSettings === "function") {
      await loadShopSettings();
      return;
    }

    if (activePage === "faq" && typeof loadFaqCms === "function") {
      await loadFaqCms();
      return;
    }

    if (activePage === "about" && typeof loadAboutContent === "function") {
      await loadAboutContent();
      return;
    }

    if (activePage === "loyalty" && typeof refreshLoyaltyExperience === "function") {
      refreshLoyaltyExperience();
      return;
    }

    if (activePage === "cart" && typeof renderCart === "function") {
      renderCart();
    }

    if (activePage === "checkout" && typeof renderCheckout === "function") {
      renderCheckout();
      return;
    }

    if (activePage === "orders" && typeof refreshOrdersPage === "function") {
      await refreshOrdersPage();
    }
  } catch (error) {
    console.warn(`Failed to refresh live data for ${activePage || "page"}`, error);
  }
}

function showPage(name) {
  const target = document.getElementById(`page-${name}`);
  if (!target) return;

  if (typeof closeProductSelection === "function") closeProductSelection();

  document.querySelectorAll(".page").forEach((page) => page.classList.remove("active"));
  target.classList.add("active");

  syncNavState(name);
  document.body.dataset.page = name;
  if (typeof window.closeMenu === "function") window.closeMenu();
  window.scrollTo(0, 0);

  // Track page view
  if (window.tracker) {
    window.tracker.track('pageview', { page: name });
  }

  if (name === "cart" && typeof renderCart === "function") renderCart();
  if (name === "checkout" && typeof renderCheckout === "function") renderCheckout();
  if (name === "orders" && typeof refreshOrdersPage === "function") refreshOrdersPage();
  refreshLivePageData(name, { force: true });
}

function showToast(iconOrMessage, maybeMessage) {
  const toast = document.getElementById("toast");
  const iconEl = document.getElementById("toast-icon");
  const msgEl = document.getElementById("toast-msg");
  if (!toast || !iconEl || !msgEl) return;

  const hasExplicitMessage = typeof maybeMessage !== "undefined";
  const icon = hasExplicitMessage ? iconOrMessage : "!";
  const message = hasExplicitMessage ? maybeMessage : iconOrMessage;

  iconEl.textContent = icon;
  msgEl.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2800);
}

document.addEventListener("DOMContentLoaded", () => {
  syncNavState("home");
  document.body.dataset.page = "home";

  if (typeof loadProducts === "function") {
    loadProducts().finally(() => renderProducts("all"));
  } else {
    renderProducts("all");
  }
});

let lastFocusRefreshAt = 0;

function refreshCurrentPageOnFocus() {
  const now = Date.now();
  if (now - lastFocusRefreshAt < 1200) return;
  lastFocusRefreshAt = now;

  const activePage = document.body?.dataset?.page;
  if (!activePage) return;
  refreshLivePageData(activePage, { force: true });
}

window.addEventListener("focus", refreshCurrentPageOnFocus);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    refreshCurrentPageOnFocus();
  }
});
