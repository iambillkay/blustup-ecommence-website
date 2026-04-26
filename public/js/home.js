const HOME_CURRENCY_SYMBOL = "\u20B5";
const homeMoneyFormatter = new Intl.NumberFormat("en-GH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const homeTimerIntervals = new Set();
let heroSliderIntervalId = null;

function formatHomeMoney(value) {
  const amount = Number(value || 0);
  return `${HOME_CURRENCY_SYMBOL}${homeMoneyFormatter.format(Number.isFinite(amount) ? amount : 0)}`;
}

function escapeHomeHtml(value) {
  if (typeof escapeStorefrontHtml === "function") return escapeStorefrontHtml(value);
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getHomeProductCategories(product) {
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

function normalizeHomeCategoryToken(value) {
  return String(value || "").trim().toLowerCase();
}

function getHomeDealSourceCategories(deal) {
  const source = Array.isArray(deal?.sourceCategories) ? deal.sourceCategories : [deal?.sourceCategory];
  const seen = new Set();
  return source
    .map((value) => String(value || "").trim())
    .filter((value) => {
      const token = normalizeHomeCategoryToken(value);
      if (!value || seen.has(token)) return false;
      seen.add(token);
      return true;
    });
}

function getHomeAds(homeSettings) {
  if (Array.isArray(homeSettings?.ads) && homeSettings.ads.length) {
    return homeSettings.ads.filter((ad) => ad && ad.isActive !== false && ad.imageUrl);
  }

  const images = Array.isArray(homeSettings?.adImages) ? homeSettings.adImages : [];
  return images.map((imageUrl, index) => ({
    id: `ad-${index + 1}`,
    imageUrl,
    title: index === 0
      ? "Discover better deals without the guesswork."
      : index === 1
        ? "Weekly picks built for value-focused shoppers."
        : "A storefront designed to feel clear and secure.",
    subtitle: "Shop curated products, compare ratings quickly, and move through checkout with confidence.",
    ctaLabel: "Shop now",
    ctaTarget: "shop",
    isActive: true,
  }));
}

function handleHomeAdClick(ad) {
  if (!ad) return;
  if (window.tracker) {
    window.tracker.track("ad_click", {
      adId: ad.id,
      title: ad.title,
      target: ad.ctaTarget,
    });
  }
  if (typeof window.navigateToCmsTarget === "function") {
    window.navigateToCmsTarget(ad.ctaTarget || "shop");
    return;
  }
  if (typeof showPage === "function") showPage("shop");
}

function homeProductCard(p) {
  return `
    <div
      class="product-card product-card-selectable"
      style="min-width:220px;"
      role="button"
      tabindex="0"
      onclick="openProductSelection('${String(p.id).replace(/'/g, "\\'")}')"
      onkeydown="handleProductCardKeydown(event, '${String(p.id).replace(/'/g, "\\'")}')"
      aria-label="View details for ${escapeHomeHtml(p.name)}"
    >
      <div class="product-img" style="background:${p.color || "#f5f7ff"}">
        ${p.badge ? `<div class="product-badge-tag ${escapeHomeHtml(p.badgeType || "")}">${escapeHomeHtml(p.badge)}</div>` : ""}
        ${
          p.imageUrl
            ? `<img src="${escapeHomeHtml(p.imageUrl)}" alt="${escapeHomeHtml(p.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`
            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#5f6b95;font-weight:600;">No image</div>`
        }
      </div>
      <div class="product-info">
        <div class="product-category">${escapeHomeHtml(getHomeProductCategories(p)[0] || p.cat)}</div>
        <div class="product-name">${escapeHomeHtml(p.name)}</div>
        ${typeof renderProductRatingMarkup === "function" ? renderProductRatingMarkup(p) : ""}
        <div class="product-footer">
          <div class="product-price">
            ${p.oldPrice ? `<span class="old-price">${formatHomeMoney(p.oldPrice)}</span>` : ""}
            ${formatHomeMoney(p.price)}
          </div>
          <button class="add-to-cart-btn" onclick="addToCart('${String(p.id).replace(/'/g, "\\'")}', event)">+ Add</button>
        </div>
      </div>
    </div>
  `;
}

function startCarousel(row) {
  if (!row) return;

  const resumeAutoScroll = () => {
    if (row._homeCarouselIntervalId) clearInterval(row._homeCarouselIntervalId);
    row._homeCarouselIntervalId = setInterval(() => {
      row.scrollBy({ left: 220, behavior: "smooth" });
    }, 3000);
  };

  if (!row._homeCarouselBound) {
    row.addEventListener("mouseenter", () => {
      if (row._homeCarouselIntervalId) clearInterval(row._homeCarouselIntervalId);
    });
    row.addEventListener("mouseleave", resumeAutoScroll);
    row._homeCarouselBound = true;
  }

  resumeAutoScroll();
}

function startTimers() {
  homeTimerIntervals.forEach((intervalId) => clearInterval(intervalId));
  homeTimerIntervals.clear();

  const timers = document.querySelectorAll(".timer-display");
  timers.forEach((timerDisplay) => {
    let timeInSeconds = parseInt(timerDisplay.getAttribute("data-seconds"), 10);
    if (Number.isNaN(timeInSeconds)) return;
    const interval = setInterval(() => {
      if (timeInSeconds <= 0) {
        timerDisplay.textContent = "Offer Expired!";
        clearInterval(interval);
        return;
      }
      const h = Math.floor(timeInSeconds / 3600);
      const m = Math.floor((timeInSeconds % 3600) / 60);
      const s = timeInSeconds % 60;
      timerDisplay.textContent = `Time Left: ${String(h).padStart(2, "0")}h : ${String(m).padStart(2, "0")}m : ${String(s).padStart(2, "0")}s`;
      timeInSeconds -= 1;
    }, 1000);
    homeTimerIntervals.add(interval);
  });
}

function goToShopFilter(filter) {
  if (typeof showPage === "function") showPage("shop");
  setTimeout(() => {
    if (typeof window.setShopFilter === "function") window.setShopFilter(filter || "all");
    else if (typeof renderProducts === "function") renderProducts(filter || "all");
  }, 30);
}

function scrollLeft(btn) {
  const row = btn.parentElement.querySelector(".product-row");
  if (row) row.scrollBy({ left: -300, behavior: "smooth" });
}

function scrollRight(btn) {
  const row = btn.parentElement.querySelector(".product-row");
  if (row) row.scrollBy({ left: 300, behavior: "smooth" });
}

function resolveDealProducts(deal, productList) {
  const ids = Array.isArray(deal.productIds) ? deal.productIds.map(String) : [];
  const max = deal.maxItems || 8;
  if (ids.length) {
    const byId = new Map(productList.map((p) => [String(p.id), p]));
    return ids.map((id) => byId.get(id)).filter(Boolean).slice(0, max);
  }
  const sourceCategories = getHomeDealSourceCategories(deal);
  return productList
    .filter((p) =>
      !sourceCategories.length
        || getHomeProductCategories(p).some(
          (category) => sourceCategories.some(
            (sourceCategory) => normalizeHomeCategoryToken(category) === normalizeHomeCategoryToken(sourceCategory)
          )
        )
    )
    .slice(0, max);
}

function renderDeals(deals, productList) {
  const sections = Array.from(document.querySelectorAll("#page-home .brand-day"));
  const activeDeals = (deals || []).filter((d) => d.isActive).slice(0, sections.length);

  sections.forEach((section, i) => {
    const deal = activeDeals[i];
    if (!deal) {
      const rowEl = section.querySelector(".product-row");
      if (rowEl?._homeCarouselIntervalId) {
        clearInterval(rowEl._homeCarouselIntervalId);
        rowEl._homeCarouselIntervalId = null;
      }
      section.style.display = "none";
      return;
    }
    section.style.display = "";
    const header = section.querySelector(".brand-header");
    const titleEl = header?.querySelector("span");
    const timerEl = header?.querySelector(".timer-display");
    const seeMoreEl = header?.querySelector("a");
    const rowEl = section.querySelector(".product-row");

    if (titleEl) titleEl.textContent = deal.name;
    if (timerEl) timerEl.setAttribute("data-seconds", String(deal.timerSeconds || 0));
    if (seeMoreEl) {
      seeMoreEl.onclick = (e) => {
        e.preventDefault();
        goToShopFilter(deal.seeMoreFilter || "all");
      };
    }
    if (rowEl) {
      const items = resolveDealProducts(deal, productList);
      rowEl.innerHTML = items.map(homeProductCard).join("");
      if (items.length > 1) startCarousel(rowEl);
      else if (rowEl._homeCarouselIntervalId) {
        clearInterval(rowEl._homeCarouselIntervalId);
        rowEl._homeCarouselIntervalId = null;
      }
    }
  });
}

function setupHeroSlider(homeSettings) {
  const track = document.querySelector(".hero-track");
  const nextBtn = document.querySelector(".hero-btn.next");
  const prevBtn = document.querySelector(".hero-btn.prev");
  const dotsContainer = document.querySelector(".hero-dots");
  if (!track || !nextBtn || !prevBtn || !dotsContainer) return;
  if (heroSliderIntervalId) {
    clearInterval(heroSliderIntervalId);
    heroSliderIntervalId = null;
  }

  const ads = getHomeAds(homeSettings);
  const slidesData = ads.length ? ads : getHomeAds({ adImages: [
    "product-imgs/ad/ad1.png",
    "product-imgs/ad/ad2.png",
    "product-imgs/ad/ad3.png",
  ] });

  track.innerHTML = slidesData
    .map((ad, i) => `
      <div
        class="hero-slide hero-slide-clickable"
        data-home-ad-index="${i}"
        role="button"
        tabindex="0"
        aria-label="${escapeHomeHtml(ad.ctaLabel || ad.title || `Open ad ${i + 1}`)}"
      >
        <img src="${escapeHomeHtml(ad.imageUrl)}" alt="${escapeHomeHtml(ad.title || `Promo ${i + 1}`)}">
      </div>`)
    .join("");
  dotsContainer.innerHTML = "";

  const slides = Array.from(track.querySelectorAll(".hero-slide"));
  let index = 0;

  track.querySelectorAll("[data-home-ad-index]").forEach((slide) => {
    const openAd = () => {
      const ad = slidesData[Number(slide.getAttribute("data-home-ad-index"))];
      handleHomeAdClick(ad);
    };
    slide.addEventListener("click", openAd);
    slide.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openAd();
    });
  });

  slides.forEach((_, i) => {
    const dot = document.createElement("span");
    if (i === 0) dot.classList.add("active");
    dot.addEventListener("click", () => {
      index = i;
      update();
    });
    dotsContainer.appendChild(dot);
  });

  function update() {
    const dots = Array.from(dotsContainer.querySelectorAll("span"));
    track.style.transform = `translateX(-${index * 100}%)`;
    slides.forEach((slide, slideIndex) => {
      slide.classList.toggle("is-active", slideIndex === index);
    });
    dots.forEach((d) => d.classList.remove("active"));
    if (dots[index]) dots[index].classList.add("active");
  }

  update();

  nextBtn.onclick = () => {
    index = (index + 1) % slides.length;
    update();
  };
  prevBtn.onclick = () => {
    index = (index - 1 + slides.length) % slides.length;
    update();
  };
  heroSliderIntervalId = setInterval(() => {
    index = (index + 1) % slides.length;
    update();
  }, 9000);
}

async function loadHomeContent(options = {}) {
  if ((options?.forceProducts === true || !products.length) && typeof loadProducts === "function") {
    await loadProducts({ force: options?.forceProducts === true });
  }

  let homeSettings = null;
  let deals = null;
  try {
    const [homeRes, dealsRes] = await Promise.all([
      apiFetch("/api/cms/home", { cache: "no-store" }),
      apiFetch("/api/cms/deals", { cache: "no-store" }),
    ]);
    const homeData = await homeRes.json().catch(() => ({}));
    const dealsData = await dealsRes.json().catch(() => ({}));
    homeSettings = homeData?.settings || null;
    deals = dealsData?.settings || null;
  } catch (_e) {}

  setupHeroSlider(homeSettings || {});
  renderDeals(deals || [], products || []);
  startTimers();

  if (typeof window.queueMotionRefresh === "function") {
    window.queueMotionRefresh(document.getElementById("page-home"));
  }
}

window.loadHomeContent = loadHomeContent;
window.refreshHomeContent = () => loadHomeContent({ forceProducts: true });

document.addEventListener("DOMContentLoaded", async () => {
  await loadHomeContent();
});
