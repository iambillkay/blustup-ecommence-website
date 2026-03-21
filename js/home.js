function homeProductCard(p) {
  return `
    <div class="product-card" style="min-width:220px;">
      <div class="product-img" style="background:${p.color || "#f5f7ff"}">
        ${p.badge ? `<div class="product-badge-tag ${p.badgeType || ""}">${p.badge}</div>` : ""}
        ${
          p.imageUrl
            ? `<img src="${p.imageUrl}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`
            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#5f6b95;font-weight:600;">No image</div>`
        }
      </div>
      <div class="product-info">
        <div class="product-category">${p.cat}</div>
        <div class="product-name">${p.name}</div>
        <div class="product-desc">${p.desc}</div>
        <div class="product-footer">
          <div class="product-price">
            ${p.oldPrice ? `<span class="old-price">$${p.oldPrice}</span>` : ""}
            $${p.price}
          </div>
          <button class="add-to-cart-btn" onclick="addToCart('${p.id}', event)">+ Add</button>
        </div>
      </div>
    </div>
  `;
}

function startCarousel(row) {
  let autoScroll = setInterval(() => {
    row.scrollBy({ left: 220, behavior: "smooth" });
  }, 3000);

  row.addEventListener("mouseenter", () => clearInterval(autoScroll));
  row.addEventListener("mouseleave", () => {
    clearInterval(autoScroll);
    autoScroll = setInterval(() => row.scrollBy({ left: 220, behavior: "smooth" }), 3000);
  });
}

function startTimers() {
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
  });
}

function goToShopFilter(filter) {
  if (typeof showPage === "function") showPage("shop");
  setTimeout(() => {
    if (typeof renderProducts === "function") renderProducts(filter || "all");
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

function renderDeals(deals, productList) {
  const sections = Array.from(document.querySelectorAll("#page-home .brand-day"));
  const activeDeals = (deals || []).filter((d) => d.isActive).slice(0, sections.length);

  sections.forEach((section, i) => {
    const deal = activeDeals[i];
    if (!deal) {
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
      const items = productList
        .filter((p) => !deal.sourceCategory || p.cat === deal.sourceCategory)
        .slice(0, deal.maxItems || 8);
      rowEl.innerHTML = items.map(homeProductCard).join("");
      startCarousel(rowEl);
    }
  });
}

function setupHeroSlider(adImages) {
  const track = document.querySelector(".hero-track");
  const nextBtn = document.querySelector(".hero-btn.next");
  const prevBtn = document.querySelector(".hero-btn.prev");
  const dotsContainer = document.querySelector(".hero-dots");
  if (!track || !nextBtn || !prevBtn || !dotsContainer) return;

  const images = Array.isArray(adImages) && adImages.length ? adImages : [
    "product-imgs/ad/ad1.png",
    "product-imgs/ad/ad2.png",
    "product-imgs/ad/ad3.png",
  ];

  track.innerHTML = images
    .map((src, i) => `<div class="hero-slide"><img src="${src}" alt="Promo ${i + 1}"></div>`)
    .join("");
  dotsContainer.innerHTML = "";

  const slides = Array.from(track.querySelectorAll(".hero-slide"));
  let index = 0;

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
    dots.forEach((d) => d.classList.remove("active"));
    if (dots[index]) dots[index].classList.add("active");
  }

  nextBtn.onclick = () => {
    index = (index + 1) % slides.length;
    update();
  };
  prevBtn.onclick = () => {
    index = (index - 1 + slides.length) % slides.length;
    update();
  };
  setInterval(() => {
    index = (index + 1) % slides.length;
    update();
  }, 9000);
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!products.length && typeof loadProducts === "function") {
    await loadProducts();
  }

  let homeSettings = null;
  let deals = null;
  try {
    const [homeRes, dealsRes] = await Promise.all([
      fetch("/api/cms/home"),
      fetch("/api/cms/deals"),
    ]);
    const homeData = await homeRes.json().catch(() => ({}));
    const dealsData = await dealsRes.json().catch(() => ({}));
    homeSettings = homeData?.settings || null;
    deals = dealsData?.settings || null;
  } catch (_e) {}

  setupHeroSlider(homeSettings?.adImages || []);
  renderDeals(deals || [], products || []);
  startTimers();
});

