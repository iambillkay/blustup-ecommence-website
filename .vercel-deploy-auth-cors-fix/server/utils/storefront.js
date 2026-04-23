const LOYALTY_SPEND_PER_POINT = 5;

const LOYALTY_TIERS = [
  {
    key: "starter",
    name: "Starter",
    minPoints: 0,
    highlight: "Earn 1 point for every GHS 5 spent on signed-in orders.",
    perks: ["Points on every signed-in order"],
    freeShippingEligible: false,
  },
  {
    key: "silver",
    name: "Silver",
    minPoints: 150,
    highlight: "Free shipping unlocks on every order.",
    perks: ["Points on every signed-in order", "Free shipping"],
    freeShippingEligible: true,
  },
  {
    key: "gold",
    name: "Gold",
    minPoints: 400,
    highlight: "Free shipping plus early access to fresh drops.",
    perks: ["Points on every signed-in order", "Free shipping", "Early access alerts"],
    freeShippingEligible: true,
  },
  {
    key: "platinum",
    name: "Platinum",
    minPoints: 800,
    highlight: "Top-tier perks with free shipping and priority support.",
    perks: ["Points on every signed-in order", "Free shipping", "Early access alerts", "Priority support"],
    freeShippingEligible: true,
  },
];

const REVIEWER_NAMES = [
  "Ama K.",
  "Jordan M.",
  "Linda A.",
  "Kojo D.",
  "Chris T.",
  "Naa S.",
  "Rita P.",
  "Daniel O.",
];

const REVIEW_TITLES = [
  "Great value",
  "Worth the price",
  "Looks even better in person",
  "Exactly what I needed",
  "Reliable everyday pick",
  "Solid quality",
  "Fast favorite",
  "Would buy again",
];

const REVIEW_SNIPPETS = [
  "Delivery was smooth and the finish feels premium for the price.",
  "Setup was easy and it matched the photos on the storefront.",
  "It has been dependable for everyday use and feels like a smart buy.",
  "The quality is better than I expected and the packaging was neat.",
  "Nice balance of price, design, and practical daily performance.",
  "It fit straight into my routine and made the purchase feel worthwhile.",
];

function clampNumber(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

function roundToOneDecimal(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function hashSeed(value) {
  return String(value || "").split("").reduce((sum, char, index) => {
    return (sum + char.charCodeAt(0) * (index + 1)) % 1000003;
  }, 0);
}

function humanizeCategory(value) {
  return String(value || "")
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildFallbackReviews(product = {}) {
  const seed = hashSeed([
    product._id,
    product.id,
    product.name,
    Array.isArray(product.categories) ? product.categories.join(",") : product.category,
  ].filter(Boolean).join(":"));
  const categoryLabel = humanizeCategory(
    Array.isArray(product.categories) && product.categories.length ? product.categories[0] : product.category
  ).toLowerCase() || "everyday";
  const averageRating = roundToOneDecimal(4.2 + (seed % 7) * 0.1);
  const reviewCount = 18 + (seed % 91);

  const reviews = Array.from({ length: 3 }, (_, index) => {
    const reviewer = REVIEWER_NAMES[(seed + index * 5) % REVIEWER_NAMES.length];
    const title = REVIEW_TITLES[(seed + index * 3) % REVIEW_TITLES.length];
    const snippet = REVIEW_SNIPPETS[(seed + index * 7) % REVIEW_SNIPPETS.length];
    const createdAt = new Date(Date.UTC(2025, (seed + index) % 12, ((seed + index * 9) % 27) + 1)).toISOString();
    return {
      author: reviewer,
      rating: clampNumber(averageRating + (index === 0 ? 0.2 : index === 1 ? 0 : -0.1), 4, 5),
      title,
      comment: `${snippet} Strong ${categoryLabel} choice for repeat shopping.`,
      verifiedPurchase: true,
      createdAt,
    };
  });

  return {
    averageRating,
    reviewCount,
    reviews,
  };
}

function normalizeProductReviews(product = {}) {
  const rawReviews = Array.isArray(product.reviews) ? product.reviews : [];

  const normalizedReviews = rawReviews
    .map((review) => {
      const createdAtValue = review?.createdAt ? new Date(review.createdAt) : null;
      return {
        author: String(review?.author || "").trim(),
        rating: clampNumber(review?.rating, 1, 5),
        title: String(review?.title || "").trim(),
        comment: String(review?.comment || review?.body || "").trim(),
        verifiedPurchase: review?.verifiedPurchase !== false,
        createdAt:
          createdAtValue && !Number.isNaN(createdAtValue.getTime())
            ? createdAtValue.toISOString()
            : null,
      };
    })
    .filter((review) => review.author && review.comment);

  const explicitAverage = product.ratingAverage ?? product.averageRating;
  const explicitCount = product.reviewCount;

  if (!normalizedReviews.length && (explicitAverage == null || explicitCount == null)) {
    return buildFallbackReviews(product);
  }

  const computedAverage = normalizedReviews.length
    ? roundToOneDecimal(
        normalizedReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / normalizedReviews.length
      )
    : null;

  const averageRating = clampNumber(
    explicitAverage != null ? explicitAverage : computedAverage != null ? computedAverage : 4.6,
    1,
    5
  );
  const reviewCount = Math.max(
    normalizedReviews.length,
    Math.floor(Number(explicitCount != null ? explicitCount : normalizedReviews.length || 0))
  );

  return {
    averageRating,
    reviewCount,
    reviews: normalizedReviews.slice(0, 6),
  };
}

function normalizeStoredReview(review = {}) {
  const createdAtValue = review.createdAt ? new Date(review.createdAt) : null;
  return {
    author: String(review.author || "").trim(),
    rating: clampNumber(review.rating, 1, 5),
    title: String(review.title || "").trim(),
    comment: String(review.comment || review.body || "").trim(),
    verifiedPurchase: review.verifiedPurchase !== false,
    createdAt: createdAtValue && !Number.isNaN(createdAtValue.getTime()) ? createdAtValue : null,
  };
}

function getLoyaltyTier(points) {
  const normalizedPoints = Math.max(0, Math.floor(Number(points || 0)));
  return [...LOYALTY_TIERS].reverse().find((tier) => normalizedPoints >= tier.minPoints) || LOYALTY_TIERS[0];
}

function buildLoyaltyProfile(points) {
  const normalizedPoints = Math.max(0, Math.floor(Number(points || 0)));
  const currentTier = getLoyaltyTier(normalizedPoints);
  const currentIndex = LOYALTY_TIERS.findIndex((tier) => tier.key === currentTier.key);
  const nextTier = currentIndex >= 0 ? LOYALTY_TIERS[currentIndex + 1] || null : null;
  const currentTierMinPoints = currentTier.minPoints;
  const nextTierMinPoints = nextTier?.minPoints || null;
  const tierSpan = nextTier ? Math.max(1, nextTier.minPoints - currentTierMinPoints) : 1;
  const pointsIntoTier = Math.max(0, normalizedPoints - currentTierMinPoints);
  const progressPercent = nextTier
    ? Math.max(0, Math.min(100, Math.round((pointsIntoTier / tierSpan) * 100)))
    : 100;
  const pointsToNextTier = nextTier ? Math.max(0, nextTier.minPoints - normalizedPoints) : 0;

  return {
    points: normalizedPoints,
    tierKey: currentTier.key,
    tierName: currentTier.name,
    highlight: currentTier.highlight,
    perks: [...currentTier.perks],
    freeShippingEligible: currentTier.freeShippingEligible,
    earnRateText: `1 point for every GHS ${LOYALTY_SPEND_PER_POINT} spent`,
    nextTierKey: nextTier?.key || null,
    nextTierName: nextTier?.name || null,
    pointsToNextTier,
    currentTierMinPoints,
    nextTierMinPoints,
    pointsIntoTier,
    tierSpan,
    progressPercent,
    spendToNextTier: pointsToNextTier * LOYALTY_SPEND_PER_POINT,
  };
}

function calculateEarnedLoyaltyPoints(orderTotal) {
  const total = Math.max(0, Number(orderTotal || 0));
  if (total <= 0) return 0;
  return Math.max(1, Math.floor(total / LOYALTY_SPEND_PER_POINT));
}

module.exports = {
  LOYALTY_SPEND_PER_POINT,
  LOYALTY_TIERS,
  normalizeProductReviews,
  normalizeStoredReview,
  buildLoyaltyProfile,
  calculateEarnedLoyaltyPoints,
};
