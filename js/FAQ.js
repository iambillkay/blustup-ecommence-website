// FAQ page — content from CMS (questions + board of directors)

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wireFaqAccordion(container) {
  const items = container.querySelectorAll(".faq-item");
  items.forEach((item) => {
    item.addEventListener("click", () => {
      items.forEach((el) => {
        if (el !== item) el.classList.remove("active");
      });
      item.classList.toggle("active");
    });
  });
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

  if (labelEl) labelEl.textContent = settings.label || "FAQ";
  if (titleEl) {
    const t = settings.pageTitle || "Questions";
    titleEl.innerHTML = escapeHtml(t).replace(/\n/g, "<br>");
  }
  if (introEl) {
    introEl.textContent = settings.intro || "";
    introEl.style.display = settings.intro ? "block" : "none";
  }
  if (helpTitleEl) helpTitleEl.textContent = settings.helpTitle || "";
  if (helpTextEl) helpTextEl.textContent = settings.helpText || "";

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
      <div class="faq-question">
        ${escapeHtml(item.question)}
        <span class="faq-icon">${i === 0 ? "▲" : "▼"}</span>
      </div>
      <div class="faq-answer">${escapeHtml(item.answer)}</div>
    </div>`
    )
    .join("");
  wireFaqAccordion(listRoot);

  if (boardTitle) boardTitle.textContent = settings.boardTitle || "Board of directors";
  if (boardGrid) {
    const board = Array.isArray(settings.board) ? settings.board : [];
    boardGrid.innerHTML = board
      .map((m) => {
        const img = m.imageUrl
          ? `<img src="${escapeHtml(m.imageUrl)}" alt="" class="board-photo">`
          : `<div class="board-photo board-photo-placeholder" aria-hidden="true">★</div>`;
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
}

async function loadFaqCms() {
  try {
    const res = await fetch("/api/cms/faq");
    const data = await res.json();
    if (!res.ok || !data?.settings) return;
    renderFaqPage(data.settings);
  } catch (_e) {
    /* static HTML fallback */
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadFaqCms();
});
