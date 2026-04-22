function escapeAboutHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function navigateToCmsTarget(target) {
  const value = String(target || "").trim();
  if (!value) return;

  if (value === "ai") {
    if (typeof openAiChat === "function") openAiChat();
    return;
  }

  if (["home", "shop", "about", "faq", "privacy", "loyalty", "orders", "cart", "checkout", "login"].includes(value)) {
    if (typeof showPage === "function") showPage(value);
    return;
  }

  if (/^https?:\/\//i.test(value)) {
    window.location.href = value;
  }
}

window.navigateToCmsTarget = navigateToCmsTarget;

function bindAboutCta(button, label, target) {
  if (!button) return;
  button.textContent = label || button.textContent;
  button.onclick = () => navigateToCmsTarget(target);
}

function renderAboutStats(stats) {
  const root = document.getElementById("about-stats-root");
  if (!root || !Array.isArray(stats) || !stats.length) return;
  root.innerHTML = stats.map((item) => `
    <div class="about-stat">
      <strong>${escapeAboutHtml(item.title)}</strong>
      <span>${escapeAboutHtml(item.text)}</span>
    </div>
  `).join("");
}

function renderAboutCards(cards) {
  const root = document.getElementById("about-cards-root");
  if (!root || !Array.isArray(cards) || !cards.length) return;
  root.innerHTML = cards.map((item) => `
    <article class="info-card">
      <h3>${escapeAboutHtml(item.title)}</h3>
      <p>${escapeAboutHtml(item.text)}</p>
    </article>
  `).join("");
}

function renderAboutPillars(pillars) {
  const root = document.getElementById("about-pillars-root");
  if (!root || !Array.isArray(pillars) || !pillars.length) return;
  root.innerHTML = pillars.map((pillar) => `
    <article class="info-card">
      <h2>${escapeAboutHtml(pillar.title)}</h2>
      <ul>
        ${(Array.isArray(pillar.items) ? pillar.items : []).map((item) => `<li>${escapeAboutHtml(item)}</li>`).join("")}
      </ul>
    </article>
  `).join("");
}

async function loadAboutContent() {
  try {
    const response = await apiFetch("/api/cms/about", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    const settings = data?.settings;
    if (!response.ok || !settings) return;

    const badge = document.getElementById("about-badge");
    const title = document.getElementById("about-title");
    const intro = document.getElementById("about-intro");
    const primaryCta = document.getElementById("about-primary-cta");
    const secondaryCta = document.getElementById("about-secondary-cta");

    if (badge) badge.textContent = settings.badge || badge.textContent;
    if (title) title.textContent = settings.title || title.textContent;
    if (intro) intro.textContent = settings.intro || intro.textContent;
    bindAboutCta(primaryCta, settings.primaryCtaLabel || "Explore the shop", settings.primaryCtaTarget || "shop");
    bindAboutCta(secondaryCta, settings.secondaryCtaLabel || "Ask Blustup AI", settings.secondaryCtaTarget || "ai");
    renderAboutStats(settings.stats || []);
    renderAboutCards(settings.cards || []);
    renderAboutPillars(settings.pillars || []);
  } catch (_error) {
    // Keep the inline fallback copy if the CMS request fails.
  }
}

window.loadAboutContent = loadAboutContent;

document.addEventListener("DOMContentLoaded", () => {
  loadAboutContent();
});
