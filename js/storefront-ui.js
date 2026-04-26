const LOYALTY_LEVELS = [
  {
    key: "starter",
    name: "Starter",
    minPoints: 0,
    highlight: "Earn 1 point for every GHS 50 spent on signed-in orders.",
    freeShippingEligible: false,
    perks: ["Points on every signed-in order"],
  },
  {
    key: "silver",
    name: "Silver",
    minPoints: 100,
    highlight: "Free shipping unlocks on every order.",
    freeShippingEligible: true,
    perks: ["Points on every signed-in order", "Free shipping"],
  },
  {
    key: "gold",
    name: "Gold",
    minPoints: 400,
    highlight: "Free shipping plus early access to fresh drops.",
    freeShippingEligible: true,
    perks: ["Points on every signed-in order", "Free shipping", "Early access alerts"],
  },
  {
    key: "platinum",
    name: "Platinum",
    minPoints: 800,
    highlight: "Top-tier perks with free shipping and priority support.",
    freeShippingEligible: true,
    perks: ["Points on every signed-in order", "Free shipping", "Early access alerts", "Priority support"],
  },
];

function escapeStorefrontHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncateStorefrontText(value, maxLength = 88) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function renderRatingStars(rating) {
  const rounded = Math.max(1, Math.min(5, Math.round(Number(rating || 0))));
  return Array.from({ length: 5 }, (_, index) =>
    `<span class="product-star ${index < rounded ? "is-filled" : ""}">&#9733;</span>`
  ).join("");
}

function getProductReviewSummary(product = {}) {
  const averageRating = Math.max(1, Math.min(5, Number(product.ratingAverage || product.averageRating || 0) || 4.6));
  const reviewCount = Math.max(0, Math.floor(Number(product.reviewCount || 0)));
  const reviews = Array.isArray(product.reviews) ? product.reviews : [];
  const featuredReview = reviews.find((review) => review && review.comment) || null;

  return {
    averageRating,
    reviewCount,
    reviews,
    featuredReview,
  };
}

function renderProductReviewMarkup(product = {}) {
  const reviewSummary = getProductReviewSummary(product);
  const ratingMarkup = renderProductRatingMarkup(product);

  return `
    ${ratingMarkup}
    ${
      reviewSummary.featuredReview
        ? `<div class="product-review-quote">"${escapeStorefrontHtml(truncateStorefrontText(reviewSummary.featuredReview.comment))}"</div>`
        : ""
    }
  `;
}

function renderProductRatingMarkup(product = {}) {
  const reviewSummary = getProductReviewSummary(product);
  const countLabel = reviewSummary.reviewCount === 1 ? "review" : "reviews";

  return `
    <div class="product-rating-row" aria-label="${escapeStorefrontHtml(reviewSummary.averageRating.toFixed(1))} out of 5 from ${escapeStorefrontHtml(reviewSummary.reviewCount)} ${countLabel}">
      <span class="product-rating-stars">${renderRatingStars(reviewSummary.averageRating)}</span>
      <span class="product-rating-value">${escapeStorefrontHtml(reviewSummary.averageRating.toFixed(1))}</span>
      <span class="product-rating-count">${escapeStorefrontHtml(reviewSummary.reviewCount)} ${countLabel}</span>
    </div>
  `;
}

const STOREFRONT_CURRENCY_SYMBOL = "\u20B5";
const storefrontMoneyFormatter = new Intl.NumberFormat("en-GH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatStorefrontMoney(value) {
  const amount = Number(value || 0);
  return `${STOREFRONT_CURRENCY_SYMBOL}${storefrontMoneyFormatter.format(Number.isFinite(amount) ? amount : 0)}`;
}

function formatStorefrontReviewDate(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return "Recent review";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getStorefrontCatalogProducts() {
  if (typeof allProducts !== "undefined" && Array.isArray(allProducts) && allProducts.length) return allProducts;
  if (typeof products !== "undefined" && Array.isArray(products) && products.length) return products;
  return [];
}

function findStorefrontProductById(id) {
  const target = String(id || "").trim();
  if (!target) return null;
  return getStorefrontCatalogProducts().find((product) => String(product?.id) === target) || null;
}

function getStorefrontProductCategories(product) {
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

function syncStorefrontProductRecord(nextProduct) {
  if (!nextProduct || !nextProduct.id) return;
  const targetId = String(nextProduct.id);

  if (typeof allProducts !== "undefined" && Array.isArray(allProducts)) {
    const allIndex = allProducts.findIndex((product) => String(product?.id) === targetId);
    if (allIndex >= 0) allProducts[allIndex] = { ...allProducts[allIndex], ...nextProduct };
  }

  if (typeof products !== "undefined" && Array.isArray(products)) {
    const currentIndex = products.findIndex((product) => String(product?.id) === targetId);
    if (currentIndex >= 0) products[currentIndex] = { ...products[currentIndex], ...nextProduct };
  }
}

function getProductDetailNodes() {
  return {
    backdrop: document.getElementById("page-product"),
    body: document.getElementById("productDetailBody"),
  };
}

function renderProductReviewForm(product = {}) {
  const currentUser = typeof getStoredUser === "function" ? getStoredUser() : null;
  const productId = String(product.id || "");
  const suggestedName = String(currentUser?.name || "").trim();
  const loginHint = suggestedName
    ? `Posting as ${escapeStorefrontHtml(suggestedName)}.`
    : "Posting as guest. Add your name so other shoppers can recognize your feedback.";

  return `
    <form class="product-review-form" id="productDetailReviewForm" data-product-id="${escapeStorefrontHtml(productId)}" novalidate>
      <div class="product-review-note">${loginHint}</div>
      <div class="product-review-field-grid">
        <label class="product-review-field">
          <span class="product-review-label">Name</span>
          <input class="product-review-input" type="text" name="author" maxlength="80" placeholder="Your name" value="${escapeStorefrontHtml(suggestedName)}" required>
        </label>
        <div class="product-review-field">
          <span class="product-review-label">Rating</span>
          <div class="product-review-rating-picker" aria-label="Choose your rating">
            <input id="productReviewRating5-${escapeStorefrontHtml(productId)}" type="radio" name="rating" value="5" checked>
            <label for="productReviewRating5-${escapeStorefrontHtml(productId)}" aria-label="5 stars" title="5 stars">&#9733;</label>
            <input id="productReviewRating4-${escapeStorefrontHtml(productId)}" type="radio" name="rating" value="4">
            <label for="productReviewRating4-${escapeStorefrontHtml(productId)}" aria-label="4 stars" title="4 stars">&#9733;</label>
            <input id="productReviewRating3-${escapeStorefrontHtml(productId)}" type="radio" name="rating" value="3">
            <label for="productReviewRating3-${escapeStorefrontHtml(productId)}" aria-label="3 stars" title="3 stars">&#9733;</label>
            <input id="productReviewRating2-${escapeStorefrontHtml(productId)}" type="radio" name="rating" value="2">
            <label for="productReviewRating2-${escapeStorefrontHtml(productId)}" aria-label="2 stars" title="2 stars">&#9733;</label>
            <input id="productReviewRating1-${escapeStorefrontHtml(productId)}" type="radio" name="rating" value="1">
            <label for="productReviewRating1-${escapeStorefrontHtml(productId)}" aria-label="1 star" title="1 star">&#9733;</label>
          </div>
        </div>
      </div>
      <label class="product-review-field">
        <span class="product-review-label">Headline</span>
        <input class="product-review-input" type="text" name="title" maxlength="120" placeholder="Summarize your experience">
      </label>
      <label class="product-review-field">
        <span class="product-review-label">Comment</span>
        <textarea class="product-review-textarea" name="comment" rows="5" maxlength="600" placeholder="What stood out about this product?" required></textarea>
      </label>
      <div class="product-review-form-feedback" aria-live="polite"></div>
      <div class="product-detail-actions">
        <button class="product-review-submit" type="submit">Submit review</button>
      </div>
    </form>
  `;
}

function setProductReviewFormFeedback(form, message = "", tone = "info") {
  const node = form?.querySelector(".product-review-form-feedback");
  if (!node) return;

  if (!message) {
    node.hidden = true;
    node.textContent = "";
    node.className = "product-review-form-feedback";
    return;
  }

  node.hidden = false;
  node.textContent = message;
  node.className = `product-review-form-feedback is-${tone}`;
}

function setProductReviewSubmitting(form, submitting) {
  const button = form?.querySelector(".product-review-submit");
  if (!button) return;
  button.disabled = submitting;
  button.textContent = submitting ? "Submitting..." : "Submit review";
  button.setAttribute("aria-busy", String(submitting));
}

async function submitStorefrontProductReview(productId, payload) {
  if (typeof api === "function") {
    return api(`/api/products/${encodeURIComponent(productId)}/reviews`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  const headers = { "Content-Type": "application/json" };
  if (typeof getToken === "function") {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await apiFetch(`/api/products/${encodeURIComponent(productId)}/reviews`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Failed to submit review");
  return data;
}

async function handleProductReviewSubmit(form) {
  const productId = String(form?.getAttribute("data-product-id") || "").trim();
  if (!productId) return;

  const formData = new FormData(form);
  const payload = {
    author: String(formData.get("author") || "").trim(),
    rating: Number(formData.get("rating") || 0),
    title: String(formData.get("title") || "").trim(),
    comment: String(formData.get("comment") || "").trim(),
  };

  if (payload.author.length < 2) {
    setProductReviewFormFeedback(form, "Enter your name before submitting.", "error");
    form.querySelector("[name=\"author\"]")?.focus();
    return;
  }

  if (!Number.isInteger(payload.rating) || payload.rating < 1 || payload.rating > 5) {
    setProductReviewFormFeedback(form, "Choose a rating from 1 to 5 stars.", "error");
    return;
  }

  if (payload.comment.length < 8) {
    setProductReviewFormFeedback(form, "Write a little more detail before submitting your review.", "error");
    form.querySelector("[name=\"comment\"]")?.focus();
    return;
  }

  setProductReviewSubmitting(form, true);
  setProductReviewFormFeedback(form, "");

  try {
    const { product } = await submitStorefrontProductReview(productId, payload);
    if (!product) throw new Error("We couldn't save your review just yet.");

    syncStorefrontProductRecord(product);

    const { body } = getProductDetailNodes();
    if (body) {
      body.innerHTML = renderProductDetailMarkup(product);
      body.querySelector(".product-detail-comments")?.scrollIntoView({ block: "start", behavior: "smooth" });
    }

    if (typeof refreshLivePageData === "function") {
      Promise.resolve(refreshLivePageData(document.body?.dataset?.page || "shop")).catch(() => {});
    }

    if (typeof showToast === "function") {
      showToast("OK", "Your review has been posted.");
    }
  } catch (error) {
    setProductReviewFormFeedback(form, error?.message || "We couldn't submit your review.", "error");
  } finally {
    setProductReviewSubmitting(form, false);
  }
}

function renderProductDetailReviews(product = {}) {
  const reviewSummary = getProductReviewSummary(product);
  const reviews = Array.isArray(reviewSummary.reviews) ? reviewSummary.reviews : [];

  if (!reviews.length) {
    return `<div class="product-detail-empty">No customer comments yet. Be the first to share your experience.</div>`;
  }

  return reviews
    .map((review) => `
      <article class="product-detail-review-card">
        <div class="product-detail-review-top">
          <div>
            <div class="product-detail-review-author">${escapeStorefrontHtml(review.author || "Verified buyer")}</div>
            <div class="product-detail-review-date">${escapeStorefrontHtml(formatStorefrontReviewDate(review.createdAt))}</div>
          </div>
          <div class="product-detail-review-score">
            <span class="product-rating-stars">${renderRatingStars(review.rating)}</span>
            <span>${escapeStorefrontHtml(Number(review.rating || 0).toFixed(1))}</span>
          </div>
        </div>
        ${review.title ? `<div class="product-detail-review-title">${escapeStorefrontHtml(review.title)}</div>` : ""}
        <p class="product-detail-review-copy">${escapeStorefrontHtml(review.comment || "")}</p>
        ${
          review.verifiedPurchase !== false
            ? `<div class="product-detail-verified">Verified purchase</div>`
            : ""
        }
      </article>
    `)
    .join("");
}

function renderProductDetailMarkup(product = {}) {
  const categories = getStorefrontProductCategories(product);
  const reviewSummary = getProductReviewSummary(product);

  return `
    <div class="product-detail-shell">
      <div class="product-detail-page-nav">
        <button class="btn-back" onclick="showPage('shop')">← Back to Shop</button>
      </div>
      <section class="product-detail-hero">
        <div class="product-detail-gallery" style="background:${escapeStorefrontHtml(product.color || "radial-gradient(ellipse at center, #ffffff 0%, #f4f6fb 100%)")}">
        ${product.badge ? `<div class="product-badge-tag premium-badge ${escapeStorefrontHtml(product.badgeType || "")}">${escapeStorefrontHtml(product.badge)}</div>` : ""}
        ${
          product.imageUrl
            ? `<img src="${escapeStorefrontHtml(product.imageUrl)}" alt="${escapeStorefrontHtml(product.name || "Product image")}">`
            : `<div class="product-detail-image-fallback">No image</div>`
        }
        </div>
        <div class="product-detail-content">
          <div class="product-detail-category-list">
            ${categories.map((category) => `<span class="product-category-chip">${escapeStorefrontHtml(category)}</span>`).join("")}
          </div>
          <div class="product-detail-headline">
            <div>
              <h2 id="productDetailTitle" class="product-detail-title">${escapeStorefrontHtml(product.name || "Product")}</h2>
              <div class="product-detail-pricing">
                <strong>${escapeStorefrontHtml(formatStorefrontMoney(product.price))}</strong>
                ${product.oldPrice ? `<span>${escapeStorefrontHtml(formatStorefrontMoney(product.oldPrice))}</span>` : ""}
              </div>
            </div>
            <div class="product-detail-actions">
              <button class="add-to-cart-btn product-detail-add-btn shimmer-btn" type="button" onclick="addToCart('${String(product.id).replace(/'/g, "\\'")}', event)">
                <span class="btn-text">Add to cart</span>
              </button>
              <button class="wishlist-heart modal-wishlist-heart ${typeof isInWishlist === 'function' && isInWishlist(product.id) ? 'wishlist-active' : ''}" type="button" data-wishlist-id="${escapeStorefrontHtml(product.id)}"
                onclick="toggleWishlist('${String(product.id).replace(/'/g, "\\'")}', event)"
                aria-pressed="${typeof isInWishlist === 'function' && isInWishlist(product.id) ? 'true' : 'false'}"
                aria-label="${typeof isInWishlist === 'function' && isInWishlist(product.id) ? 'Remove from wishlist' : 'Add to wishlist'}">${typeof isInWishlist === 'function' && isInWishlist(product.id) ? '&#9829;' : '&#9825;'}</button>
            </div>
          </div>
          <div class="product-detail-summary">
            ${renderProductReviewMarkup(product)}
          </div>
        </div>
      </section>

      <div class="product-detail-columns">
        <section class="product-detail-panel">
          <div class="product-detail-section-top">
            <h3>Description</h3>
            <span>Product overview</span>
          </div>
          <p class="product-detail-description">${escapeStorefrontHtml(product.desc || "No description available for this product yet.").replace(/\n/g, "<br>")}</p>
          <div class="product-detail-meta-grid">
            <div class="product-detail-meta-card">
              <strong>${escapeStorefrontHtml(String(reviewSummary.reviewCount || 0))}</strong>
              <span>Customer reviews</span>
            </div>
            <div class="product-detail-meta-card">
              <strong>${escapeStorefrontHtml(Number(reviewSummary.averageRating || 0).toFixed(1))}/5</strong>
              <span>Average rating</span>
            </div>
            <div class="product-detail-meta-card">
              <strong>${escapeStorefrontHtml(String(Number(product.stockQty || 0)))}</strong>
              <span>Units in stock</span>
            </div>
          </div>
        </section>

        <aside class="product-detail-panel product-detail-panel-form">
          <div class="product-detail-section-top">
            <h3>Write a review</h3>
            <span>Real shopper feedback</span>
          </div>
          ${renderProductReviewForm(product)}
        </aside>
      </div>

      <section class="product-detail-panel product-detail-comments">
        <div class="product-detail-section-top">
          <h3>Customer comments</h3>
          <span>${escapeStorefrontHtml(String(reviewSummary.reviewCount || 0))} total</span>
        </div>
        <div class="product-detail-section">
          <div class="product-detail-section-top">
            <h3>Latest reviews</h3>
            <span>Newest at the top</span>
          </div>
          <div class="product-detail-reviews-list">
            ${renderProductDetailReviews(product)}
          </div>
        </div>
      </section>
    </div>
  `;
}

function closeProductSelection() {
  if (typeof showPage === "function") {
    showPage("shop");
  }
}

function openProductSelection(productId, event) {
  event?.preventDefault?.();
  const product = findStorefrontProductById(productId);
  const { body } = getProductDetailNodes();
  if (!product || !body) return;

  if (window.tracker) {
    window.tracker.track("product_view", {
      productId: String(product.id),
      productName: product.name,
      category: Array.isArray(product.categories) ? product.categories[0] || "" : product.cat || "",
      price: Number(product.price || 0),
      page: document.body?.dataset?.page || "unknown",
    });
  }

  body.innerHTML = renderProductDetailMarkup(product);
}

function buildFallbackLoyalty(pointsValue) {
  const points = Math.max(0, Math.floor(Number(pointsValue || 0)));
  const current = [...LOYALTY_LEVELS].reverse().find((tier) => points >= tier.minPoints) || LOYALTY_LEVELS[0];
  const currentIndex = LOYALTY_LEVELS.findIndex((tier) => tier.key === current.key);
  const next = currentIndex >= 0 ? LOYALTY_LEVELS[currentIndex + 1] || null : null;
  const currentTierMinPoints = current.minPoints;
  const nextTierMinPoints = next?.minPoints || null;
  const tierSpan = next ? Math.max(1, next.minPoints - currentTierMinPoints) : 1;
  const pointsIntoTier = Math.max(0, points - currentTierMinPoints);
  const pointsToNextTier = next ? Math.max(0, next.minPoints - points) : 0;
  return {
    points,
    tierKey: current.key,
    tierName: current.name,
    highlight: current.highlight,
    perks: [...current.perks],
    freeShippingEligible: current.freeShippingEligible,
    earnRateText: "1 point for every GHS 5 spent",
    nextTierKey: next?.key || null,
    nextTierName: next?.name || null,
    pointsToNextTier,
    currentTierMinPoints,
    nextTierMinPoints,
    pointsIntoTier,
    tierSpan,
    progressPercent: next ? Math.max(0, Math.min(100, Math.round((pointsIntoTier / tierSpan) * 100))) : 100,
    spendToNextTier: pointsToNextTier * 5,
  };
}

function getCurrentLoyaltyState(user) {
  const sourceUser = user || (typeof getStoredUser === "function" ? getStoredUser() : null);
  if (sourceUser?.loyalty && typeof sourceUser.loyalty === "object") {
    return {
      ...buildFallbackLoyalty(sourceUser.loyaltyPoints ?? sourceUser.loyalty.points),
      ...sourceUser.loyalty,
      points: Math.max(
        0,
        Math.floor(Number(sourceUser.loyalty.points ?? sourceUser.loyaltyPoints ?? 0))
      ),
    };
  }
  return buildFallbackLoyalty(sourceUser?.loyaltyPoints);
}

function refreshLoyaltyExperience(user) {
  const sourceUser = user || (typeof getStoredUser === "function" ? getStoredUser() : null);
  const loyalty = getCurrentLoyaltyState(sourceUser);
  const signedIn = Boolean(sourceUser && sourceUser.email);

  const pointsValue = document.getElementById("loyaltyPointsValue");
  const tierBadge = document.getElementById("loyaltyTierBadge");
  const tierSummary = document.getElementById("loyaltyTierSummary");
  const tierNext = document.getElementById("loyaltyNextTier");
  const perksList = document.getElementById("loyaltyPerksList");
  const accountNote = document.getElementById("loyaltyAccountNote");
  const progressFill = document.getElementById("loyaltyProgressFill");
  const progressText = document.getElementById("loyaltyProgressText");
  const currentTierRange = document.getElementById("loyaltyCurrentTierRange");
  const nextTierTarget = document.getElementById("loyaltyNextTierTarget");
  const spendToNextTier = document.getElementById("loyaltySpendToNextTier");
  const perkStatus = document.getElementById("loyaltyPerkStatus");
  const footerPoints = document.querySelectorAll("[data-loyalty-points-label]");

  if (pointsValue) pointsValue.textContent = signedIn ? `${loyalty.points}` : "0";
  if (tierBadge) tierBadge.textContent = signedIn ? loyalty.tierName : "Sign in";
  if (tierSummary) {
    tierSummary.textContent = signedIn
      ? loyalty.highlight || "Your loyalty perks travel with every signed-in order."
      : "Sign in before checkout to start earning loyalty points on every order.";
  }
  if (tierNext) {
    tierNext.textContent = signedIn && loyalty.nextTierName
      ? `${loyalty.pointsToNextTier} more points to reach ${loyalty.nextTierName}.`
      : signedIn
        ? "You have reached the highest loyalty tier."
        : "Starter members begin earning immediately after the first signed-in purchase.";
  }
  if (perksList) {
    const perks = signedIn ? loyalty.perks : ["Earn points on every signed-in order", "Unlock free shipping at Silver"];
    perksList.innerHTML = perks
      .map((perk) => `<li>${escapeStorefrontHtml(perk)}</li>`)
      .join("");
  }
  if (accountNote) {
    accountNote.textContent = signedIn
      ? `${sourceUser.email} currently has ${loyalty.points} points. ${loyalty.earnRateText}.`
      : "Create an account or sign in to turn purchases into loyalty points and shipping perks.";
  }
  if (progressFill) progressFill.style.width = `${signedIn ? loyalty.progressPercent || 0 : 0}%`;
  if (progressText) {
    progressText.textContent = signedIn
      ? loyalty.nextTierName
        ? `${loyalty.pointsIntoTier || 0} points earned in ${loyalty.tierName}. ${loyalty.pointsToNextTier} more to reach ${loyalty.nextTierName}.`
        : "You are at the highest loyalty tier. Every signed-in order still adds points to your balance."
      : "Sign in to watch your progress toward free shipping and higher loyalty tiers.";
  }
  if (currentTierRange) {
    currentTierRange.textContent = signedIn
      ? `${loyalty.tierName} starts at ${loyalty.currentTierMinPoints || 0} pts`
      : "Starter starts at 0 pts";
  }
  if (nextTierTarget) {
    nextTierTarget.textContent = signedIn && loyalty.nextTierName
      ? `${loyalty.nextTierName} unlocks at ${loyalty.nextTierMinPoints || 0} pts`
      : signedIn
        ? "Top tier unlocked"
        : "Silver unlocks at 150 pts";
  }
  if (spendToNextTier) {
    spendToNextTier.textContent = signedIn && loyalty.nextTierName
      ? `GHS ${Math.max(0, Number(loyalty.spendToNextTier || 0))}`
      : signedIn
        ? "Unlocked"
        : "Sign in";
  }
  if (perkStatus) {
    perkStatus.textContent = signedIn
      ? loyalty.freeShippingEligible
        ? "Free shipping active"
        : "Standard shipping"
      : "Locked";
  }

  footerPoints.forEach((node) => {
    node.textContent = signedIn ? `${loyalty.points} pts` : "Earn points";
  });
}

window.escapeStorefrontHtml = escapeStorefrontHtml;
window.getProductReviewSummary = getProductReviewSummary;
window.renderProductRatingMarkup = renderProductRatingMarkup;
window.renderProductReviewMarkup = renderProductReviewMarkup;
window.openProductSelection = openProductSelection;
window.closeProductSelection = closeProductSelection;
window.handleProductCardKeydown = handleProductCardKeydown;
window.getCurrentLoyaltyState = getCurrentLoyaltyState;
window.refreshLoyaltyExperience = refreshLoyaltyExperience;

document.addEventListener("DOMContentLoaded", () => {
  refreshLoyaltyExperience();
});

document.addEventListener("click", (event) => {
  const { backdrop } = getProductDetailNodes();
  if (!backdrop) return;

  if (event.target?.closest?.("[data-product-detail-close]")) {
    closeProductSelection();
    return;
  }

  if (event.target === backdrop) {
    closeProductSelection();
  }
});

document.addEventListener("submit", (event) => {
  const form = event.target?.closest?.("#productDetailReviewForm");
  if (!form) return;
  event.preventDefault();
  handleProductReviewSubmit(form);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeProductSelection();
  }
});
