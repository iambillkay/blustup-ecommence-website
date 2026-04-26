/* ─── Wishlist Core Logic ─── */
const WISHLIST_STORAGE_KEY = "blustup_wishlist";

let wishlistIds = new Set();
let wishlistProducts = [];

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

function updateWishlistHearts() {
  document.querySelectorAll(".wishlist-btn").forEach((btn) => {
    const id = btn.getAttribute("data-wishlist-id");
    if (!id) return;
    const active = isInWishlist(id);
    btn.classList.toggle("wishlist-active", active);
  });

  const count = wishlistIds.size;
  const badges = [document.getElementById("wishlist-count"), document.getElementById("wishlist-count-mobile")];
  badges.forEach((badge) => {
    if (badge) {
      badge.textContent = count;
      badge.style.display = count ? "flex" : "none";
    }
  });
}

async function toggleWishlist(productId, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  const id = String(productId);
  const token = typeof getToken === "function" ? getToken() : null;
  const wasIn = isInWishlist(id);

  if (wasIn) wishlistIds.delete(id);
  else wishlistIds.add(id);
  saveWishlistToStorage();
  updateWishlistHearts();

  if (token) {
    try {
      const endpoint = `/api/wishlist/${encodeURIComponent(id)}`;
      const method = wasIn ? "DELETE" : "POST";
      const result = await api(endpoint, { method });
      if (result && result.wishlist) {
        wishlistProducts = result.wishlist;
        wishlistIds = new Set(result.wishlist.map((p) => String(p.id)));
        saveWishlistToStorage();
        updateWishlistHearts();
        if (isWishlistPageActive()) renderWishlistPage();
      }
    } catch (err) {
      if (wasIn) wishlistIds.add(id);
      else wishlistIds.delete(id);
      saveWishlistToStorage();
      updateWishlistHearts();
      if (typeof showToast === "function") showToast('<svg class="icon" aria-hidden="true"><use xlink:href="#icon-error"></use></svg>', "Sync failed");
    }
  } else {
    if (isWishlistPageActive()) renderWishlistPage();
  }

  if (typeof showToast === "function") {
    showToast('<svg class="icon" aria-hidden="true"><use xlink:href="#icon-heart"></use></svg>', wasIn ? "Removed from wishlist" : "Added to wishlist");
  }
}

function isWishlistPageActive() {
  const page = document.getElementById("page-wishlist");
  return page && (page.style.display === "block" || !page.style.display);
}

async function moveToCart(productId, event) {
  if (event) event.stopPropagation();
  // 1. Add to cart
  if (typeof addToCart === "function") {
    await addToCart(productId, null);
  }
  // 2. Remove from wishlist
  await toggleWishlist(productId, null);
  
  if (typeof showToast === "function") {
    showToast('<svg class="icon" aria-hidden="true"><use xlink:href="#icon-cart"></use></svg>', "Moved to cart!");
  }
}

function shareWishlist() {
  const items = Array.from(wishlistIds);
  if (!items.length) {
    if (typeof showToast === "function") showToast('<svg class="icon" aria-hidden="true"><use xlink:href="#icon-error"></use></svg>', "Wishlist is empty");
    return;
  }

  const shareData = {
    title: "My Blustup Wishlist",
    text: `Check out these products I saved on Blustup: ${items.length} items.`,
    url: window.location.href // In a real app, this would be a specific share URL
  };

  if (navigator.share) {
    navigator.share(shareData).catch(() => copyWishlistLink());
  } else {
    copyWishlistLink();
  }
}

function copyWishlistLink() {
  const dummy = document.createElement("input");
  document.body.appendChild(dummy);
  dummy.value = window.location.href;
  dummy.select();
  document.execCommand("copy");
  document.body.removeChild(dummy);
  if (typeof showToast === "function") showToast('<svg class="icon" aria-hidden="true"><use xlink:href="#icon-link"></use></svg>', "Link copied to clipboard!");
}

async function loadWishlist() {
  const token = typeof getToken === "function" ? getToken() : null;
  loadWishlistFromStorage();

  if (token) {
    try {
      const result = await api("/api/wishlist");
      if (result && result.wishlist) {
        wishlistProducts = result.wishlist;
        wishlistIds = new Set(result.wishlist.map(p => String(p.id)));
        saveWishlistToStorage();
      }
    } catch (_e) {}
  }
  updateWishlistHearts();
}

function renderWishlistPage() {
  const grid = document.getElementById("wishlist-grid");
  const empty = document.getElementById("wishlist-empty");
  if (!grid) return;

  const localCatalog = typeof getCatalogProducts === "function" ? getCatalogProducts() : [];
  const items = [...wishlistIds].map((id) => {
    const srv = wishlistProducts.find((p) => String(p.id) === id);
    return srv || localCatalog.find((p) => String(p.id) === id);
  }).filter(Boolean);

  if (!items.length) {
    grid.innerHTML = "";
    if (empty) {
      empty.innerHTML = `
        <div class="wishlist-empty-state">
          <div class="icon"><svg class="icon" style="font-size:48px;" aria-hidden="true"><use xlink:href="#icon-heart"></use></svg></div>
          <h2>Your wishlist is empty</h2>
          <p>Browse our shop and tap the heart icon on any product to save it for later.</p>
          <button class="checkout-btn" onclick="showPage('shop')">Browse the Shop</button>
        </div>
      `;
      empty.style.display = "block";
    }
    return;
  }

  if (empty) empty.style.display = "none";

  grid.innerHTML = items.map((p) => `
    <div class="product-card" onclick="openProductSelection('${String(p.id).replace(/'/g, "\\'")}')">
      <div class="product-quick-actions">
        <button class="quick-action-btn wishlist-btn wishlist-active" onclick="toggleWishlist('${String(p.id).replace(/'/g, "\\'")}', event)">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
      </div>

      <div class="product-img" style="background:${p.color || '#f8fafc'}">
        ${p.badge ? `<div class="product-badge-tag">${escWish(p.badge)}</div>` : ""}
        ${p.imageUrl
          ? `<img src="${escWish(p.imageUrl)}" alt="${escWish(p.name)}" onerror="this.parentElement.innerHTML='<div class=\'no-image-placeholder\'><svg viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\'><rect x=\'3\' y=\'3\' width=\'18\' height=\'18\' rx=\'2\' ry=\'2\'/><circle cx=\'8.5\' cy=\'8.5\' r=\'1.5\'/><polyline points=\'21 15 16 10 5 21\'/></svg><span>Image coming soon</span></div>'">`
          : `<div class="no-image-placeholder">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
               <span>Image coming soon</span>
             </div>`}
      </div>
      
      <div class="product-info">
        <div class="product-category-list">
          ${getWishlistProductCategories(p).map((cat) => `<span class="product-category-chip">${escWish(cat)}</span>`).join("")}
        </div>
        <h2 class="product-name">${escWish(p.name)}</h2>
        <div class="product-footer">
          <div class="product-price">
            ${p.oldPrice ? `<span class="old-price">${formatWishlistMoney(p.oldPrice)}</span>` : ""}
            ${formatWishlistMoney(p.price)}
          </div>
          <button class="add-to-cart-btn" onclick="moveToCart('${String(p.id).replace(/'/g, "\\'")}', event)">
            <span class="add-btn-icon"><svg class="icon" aria-hidden="true"><use xlink:href="#icon-cart"></use></svg></span>
            Move to Cart
          </button>
        </div>
      </div>
    </div>
  `).join("");
}

window.toggleWishlist = toggleWishlist;
window.moveToCart = moveToCart;
window.shareWishlist = shareWishlist;
window.renderWishlistPage = renderWishlistPage;

document.addEventListener("DOMContentLoaded", () => {
  loadWishlist();
});
