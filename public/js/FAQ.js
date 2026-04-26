// FAQ page — content from CMS (questions + board of directors)

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setFaqItemState(item, isActive) {
  item.classList.toggle("active", isActive);
  const trigger = item.querySelector(".faq-question");
  if (trigger) trigger.setAttribute("aria-expanded", isActive ? "true" : "false");
  if (answer) {
    answer.style.maxHeight = isActive ? `${answer.scrollHeight}px` : "0px";
    answer.setAttribute("aria-hidden", isActive ? "false" : "true");
  }
}
function wireFaqAccordion(container) {
  const items = Array.from(container.querySelectorAll(".faq-item"));
  items.forEach((item, index) => {
    const trigger = item.querySelector(".faq-question") || item;
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      items.forEach((el, idx) => setFaqItemState(el, idx === index));
    });
  });
  items.forEach((item, index) => setFaqItemState(item, index === 0));
}

function renderFaqPage(settings) {
  const labelEl = document.getElementById("faq-label");
  const titleEl = document.getElementById("faq-page-title");
  const introEl = document.getElementById("faq-intro");
  const helpTitleEl = document.getElementById("faq-help-title");
  const helpTextEl = document.getElementById("faq-help-text");
  const helpBtn = document.getElementById("faq-email-btn");
  const listRoot = document.getElementById("faq-list-root");
  const boardTitle = document.getElementById("faq-board-title");
  const boardGrid = document.getElementById("faq-board-grid");

  if (!settings || !listRoot) return;

  if (labelEl !== null) labelEl.textContent = settings.label || "FAQ";
  if (titleEl !== null) {
    const t = settings.pageTitle || "Questions";
    titleEl.innerHTML = escapeHtml(t).replace(/\n/g, "<br>");
  }
  if (introEl !== null) {
    introEl.textContent = settings.intro || "";
    introEl.style.display = settings.intro ? "block" : "none";
  }
  if (helpTitleEl !== null) helpTitleEl.textContent = settings.helpTitle || "";
  if (helpTextEl !== null) helpTextEl.textContent = settings.helpText || "";

  if (helpBtn) {
    const email = (settings.contactEmail || "").trim();
    helpBtn.onclick = () => {
      if (email) {
        window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent("Blustup support")}`;
      } else if (typeof showToast === "function") {
        showToast("📧", "Contact email is not set yet.");
      }
    };
  }

  const faqs = Array.isArray(settings.faqs) ? settings.faqs : [];
  listRoot.innerHTML = faqs
    .map(
      (item, i) => `
    <div class="faq-item ${i === 0 ? "active" : ""}">
      <button class="faq-question" type="button">
        <span>${escapeHtml(item.question)}</span>
        <span class="faq-icon"><svg class="icon" aria-hidden="true"><use xlink:href="#icon-chevron-right"></use></svg></span>
      </button>
      <div class="faq-answer">${escapeHtml(item.answer)}</div>
    </div>`
    )
    .join("");
  wireFaqAccordion(listRoot);

  if (boardTitle !== null) boardTitle.textContent = settings.boardTitle || "Board of directors";
  if (boardGrid !== null) {
    const board = Array.isArray(settings.board) ? settings.board : [];
    boardGrid.innerHTML = board
      .map((m) => {
        const img = m.imageUrl
          ? `<img src="${escapeHtml(m.imageUrl)}" alt="" class="board-photo">`
          : `<div class="board-photo board-photo-placeholder" aria-hidden="true"><svg class="icon" aria-hidden="true"><use xlink:href="#icon-star"></use></svg></div>`;
        return `
      <article class="board-card">
        ${img}
        <div class="board-body">
          <div class="board-name">${escapeHtml(m.name)}</div>
          <div class="board-role">${escapeHtml(m.role)}</div>
          <p class="board-bio">${escapeHtml(m.bio)}</p>
        </div>
      </article>`;
      })
      .join("");
  }

  if (typeof window.queueMotionRefresh === "function") {
    window.queueMotionRefresh(document.getElementById("page-faq"));
  }
}

async function loadFaqCms() {
  try {
    const res = await apiFetch("/api/cms/faq", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data?.settings) return;
    renderFaqPage(data.settings);
  } catch (_e) {
    /* static HTML fallback */
  }
}

window.loadFaqCms = loadFaqCms;

document.addEventListener("DOMContentLoaded", () => {
  loadFaqCms();
});
