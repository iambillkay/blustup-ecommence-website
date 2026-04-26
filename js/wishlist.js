/* ─── Wishlist Core Logic ─── */
const WISHLIST_STORAGE_KEY = "blustup_wishlist";

// Stores a Set of String product IDs.
let wishlistIds = new Set();
// Stores the actual product data fetched from either DB or Catalog
let wishlistProducts = [];

/* Formatting helpers */
function getWishlistCurrency() {
  return typeof STOREFRONT_CURRENCY_SYMBOL === "string" ? STOREFRONT_CURRENCY_SYMBOL : "\u20B5";
}
const wishlistMoneyFmt = new Intl.NumberFormat("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function formatWishlistMoney(v) {
  const n = Number(v || 0);
  return `${getWishlistCurrency()}${wishlistMoneyFmt.format(Number.isFinite(n) ? n : 0)}`;
}
function escWish(v) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function getWishlistProductCategories(product) {
  const source = Array.isArray(product?.categories) ? product.categories : [product?.cat];
  const seen = new Set();
  return source.map((v) => String(v || "").trim()).filter((v) => {
    const t = v.toLowerCase();
    if (!v || seen.has(t)) return false;
    seen.add(t);
    return true;
  });
}

/* Local Storage Cache */
function loadWishlistFromStorage() {
  try {
    const raw = localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (raw) wishlistIds = new Set(JSON.parse(raw));
  } catch (_e) {}
}

function saveWishlistToStorage() {
  try {
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify([...wishlistIds]));
  } catch (_e) {}
}

function isInWishlist(productId) {
  return wishlistIds.has(String(productId));
}

/* DOM Syncing */
function updateWishlistHearts() {
  // Sync the standard heart icons on ALL product cards
  document.querySelectorAll(".wishlist-heart").forEach((btn) => {
    const id = btn.getAttribute("data-wishlist-id");
    if (!id) return;
    const active = isInWishlist(id);
    btn.classList.toggle("wishlist-active", active);
    btn.setAttribute("aria-pressed", String(active));
    btn.setAttribute("aria-label", active ? "Remove from wishlist" : "Add to wishlist");
    btn.innerHTML = active ? "&#9829;" : "&#9825;"; // Unicodes for filled/empty heart
  });

  // Sync the specialized animated pill buttons
  document.querySelectorAll(".pill-wishlist-btn").forEach((btn) => {
    const id = btn.getAttribute("data-wishlist-id");
    if (!id) return;
    const active = isInWishlist(id);
    btn.classList.toggle("wishlist-active", active);
    btn.setAttribute("aria-pressed", String(active));
    btn.setAttribute("aria-label", active ? "Remove from wishlist" : "Add to wishlist");
    
    const textSpan = btn.querySelector(".pill-text");
    const iconSpan = btn.querySelector(".pill-icon");
    if (textSpan) textSpan.innerHTML = active ? "Saved" : "Wishlist";
    if (iconSpan) iconSpan.innerHTML = active ? "&#9829;" : "&#9825;";
  });

  // Update nav badge count
  const count = wishlistIds.size;
  const badges = [document.getElementById("wishlist-count"), document.getElementById("wishlist-count-mobile")];
  badges.forEach((badge) => {
    if (badge) {
      badge.textContent = count;
      badge.style.display = count ? "flex" : "none";
    }
  });
}

/* Toggle Logic */
async function toggleWishlist(productId, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  const id = String(productId);
  const token = typeof getToken === "function" ? getToken() : null;
  const wasIn = isInWishlist(id);

  // 1. Optimistic UI update immediately
  if (wasIn) wishlistIds.delete(id);
  else wishlistIds.add(id);
  saveWishlistToStorage();
  updateWishlistHearts();

  // If signed in, sync specifically the single change to the backend APIs
  if (token) {
    try {
      const endpoint = `/api/wishlist/${encodeURIComponent(id)}`;
      const method = wasIn ? "DELETE" : "POST";

      const result = typeof api === "function"
        ? await api(endpoint, { method })
        : await fetch(typeof buildApiUrl === "function" ? buildApiUrl(endpoint) : endpoint, {
            method,
            headers: { Authorization: `Bearer ${token}` },
          }).then(async (r) => {
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Wishlist update failed");
            return d;
          });

      if (result && result.wishlist) {
        wishlistProducts = result.wishlist;
        wishlistIds = new Set(result.wishlist.map((p) => String(p.id)));
        saveWishlistToStorage();
        updateWishlistHearts();
        
        // Check if we are currently viewing the wishlist page!
        const currentActivePage = document.querySelector('.page[style*="display: block"]') || document.querySelector('.page:not([style*="display: none"])');
        if (currentActivePage && currentActivePage.id === "page-wishlist") {
          renderWishlistPage();
        }
      }
    } catch (err) {
      // Revert if API failed
      if (wasIn) wishlistIds.add(id);
      else wishlistIds.delete(id);
      saveWishlistToStorage();
      updateWishlistHearts();
      if (typeof showToast === "function") showToast("!", err.message || "Failed to update wishlist");
      return;
    }
  } else {
    // Guest User updates the wishlist grid in real time if they are on it
    const currentActivePage = document.querySelector('.page[style*="display: block"]') || document.querySelector('.page:not([style*="display: none"])');
    if (currentActivePage && currentActivePage.id === "page-wishlist") {
       renderWishlistPage();
    }
  }

  if (typeof showToast === "function") {
    showToast("OK", wasIn ? "Removed from wishlist" : "Added to wishlist");
  }
}

/* Boot & Merge Data */
async function loadWishlist() {
  const token = typeof getToken === "function" ? getToken() : null;
  loadWishlistFromStorage(); // Always start with local cache

  if (!token) {
    updateWishlistHearts();
    return;
  }

  // ─── The Merge Logic (Hydrate Server) ─── //
  // Pushes any guest items added prior to login
  const pendingLocalIds = [...wishlistIds];
  
  try {
    // 1. Fetch from server
    let result = typeof api === "function"
      ? await api("/api/wishlist")
      : await fetch(typeof buildApiUrl === "function" ? buildApiUrl("/api/wishlist") : "/api/wishlist", {
          headers: { Authorization: `Bearer ${token}` },
        }).then(async (r) => {
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.error || "Failed");
          return d;
        });

    let srvItems = result.wishlist || [];
    const srvIds = new Set(srvItems.map(p => String(p.id)));

    // 2. Identify missing items on server
    const toPush = pendingLocalIds.filter(id => !srvIds.has(id));

    // 3. Push missing items to backend sequentially
    for (const missingId of toPush) {
      const endpoint = `/api/wishlist/${encodeURIComponent(missingId)}`;
      const reqRes = typeof api === "function"
        ? await api(endpoint, { method: "POST" })
        : await fetch(typeof buildApiUrl === "function" ? buildApiUrl(endpoint) : endpoint, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          }).then(async (r) => {
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "Failed");
            return d;
          }).catch(() => null);

      if (reqRes && reqRes.wishlist) {
        srvItems = reqRes.wishlist; 
      }
    }

    // 4. Overwrite context cleanly
    wishlistProducts = srvItems;
    wishlistIds = new Set(srvItems.map((p) => String(p.id)));
    saveWishlistToStorage();

  } catch (_e) {
    // fallback context
    loadWishlistFromStorage();
  }

  updateWishlistHearts();
}

/* Page Render */
function renderWishlistPage() {
  const grid = document.getElementById("wishlist-grid");
  const empty = document.getElementById("wishlist-empty");
  if (!grid) return;

  const token = typeof getToken === "function" ? getToken() : null;
  
  // 1. Extract Full Product Models
  const localCatalog = typeof getStorefrontCatalogProducts === "function" ? getStorefrontCatalogProducts() : [];
  
  // Merge items. For users: priority on wishlistProducts. For guests: heavily reliant on localCatalog.
  const items = [...wishlistIds].map((id) => {
    const srv = wishlistProducts.find((p) => String(p.id) === id);
    if (srv) return srv;
    return localCatalog.find((p) => String(p.id) === id);
  }).filter(Boolean);

  // 2. Empty State Handling 
  if (!items.length) {
    grid.innerHTML = "";
    if (empty) {
      empty.innerHTML = `
        <div class="wishlist-empty-state">
          <div class="icon">💝</div>
          <h2>Your wishlist is empty</h2>
          <p>Browse our shop and tap the heart icon on any product to save it for later.</p>
          <button class="btn-primary" onclick="showPage('shop')">Browse the Shop</button>
        </div>
      `;
      empty.style.display = "";
    }
    return;
  }

  if (empty) empty.style.display = "none";

  // 3. Grid Rendering
  grid.innerHTML = items.map((p) => `
    <div class="product-card product-card-selectable" role="button" tabindex="0"
      onclick="openProductSelection('${String(p.id).replace(/'/g, "\\'")}')"
      onkeydown="handleProductCardKeydown(event, '${String(p.id).replace(/'/g, "\\'")}')"
      aria-label="View details for ${escWish(p.name)}">
      
      <div class="product-img" style="background:${p.color || '#f5f7ff'}">
        ${p.badge ? `<div class="product-badge-tag ${p.badgeType || ""}">${escWish(p.badge)}</div>` : ""}
        <button class="wishlist-heart wishlist-active" type="button" data-wishlist-id="${escWish(p.id)}"
          onclick="toggleWishlist('${String(p.id).replace(/'/g, "\\'")}', event)" 
          aria-pressed="true" aria-label="Remove from wishlist">&#9829;</button>
        ${p.imageUrl
          ? `<img src="${escWish(p.imageUrl)}" alt="${escWish(p.name)}" style="width:100%;height:100%;object-fit:cover;">`
          : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#5f6b95;font-weight:600;">No image</div>`}
      </div>
      
      <div class="product-info">
        <div class="product-category-list">
          ${getWishlistProductCategories(p)
            .slice(0, 3)
            .map((cat) => `<span class="product-category-chip">${escWish(cat.replace(/-/g, ' '))}</span>`)
            .join("")}
        </div>
        <div class="product-name">${escWish(p.name)}</div>
        ${typeof renderProductRatingMarkup === "function" ? renderProductRatingMarkup(p) : ""}
        
        <div class="product-footer">
          <div class="product-price">
            ${p.oldPrice ? `<span class="old-price">${formatWishlistMoney(p.oldPrice)}</span>` : ""}
            ${formatWishlistMoney(p.price)}
          </div>
          <button class="add-to-cart-btn" onclick="addToCart('${String(p.id).replace(/'/g, "\\'")}', event)">+ Add</button>
        </div>
      </div>
    </div>
  `).join("");
}

// Ensure overrides available
window.toggleWishlist = toggleWishlist;
window.isInWishlist = isInWishlist;
window.loadWishlist = loadWishlist;
window.renderWishlistPage = renderWishlistPage;

document.addEventListener("DOMContentLoaded", () => {
  // Always boot on layout ready
  loadWishlistFromStorage();
  updateWishlistHearts();
  // Safe async trigger
  loadWishlist();
});
