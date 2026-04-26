// Router, toast, and base app initialization

function syncNavState(pageName) {
  document.querySelectorAll("[data-nav-page]").forEach((link) => {
    link.classList.toggle("active-link", link.getAttribute("data-nav-page") === pageName);
  });
}

const MOTION_TARGET_SELECTORS = [
  ".hero-banner",
  ".brand-day",
  ".shop-hero",
  ".shop-filters",
  ".products-grid > .product-card",
  ".product-row > .product-card",
  ".faq-left",
  ".faq-help",
  ".faq-item",
  ".board-card",
  ".site-page-hero",
  ".about-stats > .about-stat",
  ".site-page-grid > .info-card",
  ".loyalty-step",
  ".loyalty-mini-stat",
  ".orders-hero",
  ".orders-panel",
  ".orders-results-panel",
  ".success-card",
  "footer",
].join(", ");

const motionMediaQuery = typeof window.matchMedia === "function"
  ? window.matchMedia("(prefers-reduced-motion: reduce)")
  : null;
let motionObserver = null;

function prefersReducedMotion() {
  return Boolean(motionMediaQuery?.matches);
}

function getMotionVariant(node) {
  if (!node || typeof node.matches !== "function") return "rise";
  if (node.matches(".hero-banner, .shop-hero, .site-page-hero, .orders-hero, .success-card")) return "scale";
  if (node.matches(".brand-day, footer")) return "slide";
  return "rise";
}

function ensureMotionObserver() {
  if (motionObserver || prefersReducedMotion() || typeof IntersectionObserver === "undefined") return;

  motionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      entry.target.classList.remove("is-pending");
      motionObserver.unobserve(entry.target);
    });
  }, {
    threshold: 0.16,
    rootMargin: "0px 0px -8% 0px",
  });
}

function prepareMotionNode(node, index, options = {}) {
  if (!node?.classList) return;

  const force = options?.force === true;
  node.classList.add("motion-reveal", `motion-${getMotionVariant(node)}`);
  node.style.setProperty("--motion-order", String(index % 10));

  if (prefersReducedMotion()) {
    node.classList.add("is-visible");
    node.classList.remove("is-pending");
    return;
  }

  if (!force && node.dataset.motionPrepared === "true" && node.classList.contains("is-visible")) {
    return;
  }

  node.dataset.motionPrepared = "true";
  node.classList.add("is-pending");
  node.classList.remove("is-visible");

  ensureMotionObserver();
  if (motionObserver) motionObserver.observe(node);
}

function refreshMotionEffects(scope = document, options = {}) {
  const root = scope && typeof scope.querySelectorAll === "function" ? scope : document;
  const nodes = Array.from(root.querySelectorAll(MOTION_TARGET_SELECTORS));
  nodes.forEach((node, index) => prepareMotionNode(node, index, options));
}

function queueMotionRefresh(scope = document, options = {}) {
  const root = scope;
  window.requestAnimationFrame(() => {
    refreshMotionEffects(root, options);
  });
}

window.refreshMotionEffects = refreshMotionEffects;
window.queueMotionRefresh = queueMotionRefresh;

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
  } finally {
    const pageRoot = document.getElementById(`page-${activePage}`);
    if (pageRoot?.classList.contains("active")) {
      queueMotionRefresh(pageRoot);
    }
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
  queueMotionRefresh(target, { force: true });

  // Track page view
  if (window.tracker) {
    window.tracker.track('pageview', { page: name });
  }

  if (name === "cart" && typeof renderCart === "function") renderCart();
  if (name === "checkout" && typeof renderCheckout === "function") renderCheckout();
  if (name === "orders" && typeof refreshOrdersPage === "function") refreshOrdersPage();
  if (name === "wishlist" && typeof renderWishlistPage === "function") renderWishlistPage();
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

  iconEl.innerHTML = icon;
  msgEl.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2800);
}

function removeSiteSkeleton() {
  const skel = document.getElementById("app-site-skeleton");
  const styles = document.getElementById("skeleton-styles");
  if (!skel) return;
  
  // Trigger CSS fade smoothly
  skel.style.opacity = "0";
  skel.style.visibility = "hidden";
  
  setTimeout(() => {
    if (skel) skel.remove();
    if (styles) styles.remove();
  }, 450);
}

document.addEventListener("DOMContentLoaded", () => {
  syncNavState("home");
  document.body.dataset.page = "home";
  refreshMotionEffects(document);
  queueMotionRefresh(document.getElementById("page-home"));

  if (typeof loadProducts === "function") {
    loadProducts().finally(() => {
      renderProducts("all");
      removeSiteSkeleton();
    });
  } else {
    renderProducts("all");
    removeSiteSkeleton();
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
