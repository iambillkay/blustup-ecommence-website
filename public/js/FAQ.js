// faq.js — Modernized FAQ handling with Search and Filtering

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let allFaqs = [];

function setFaqItemState(item, isActive) {
  item.classList.toggle("active", isActive);
  const trigger = item.querySelector(".faq-question");
  const answer = item.querySelector(".faq-answer");
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
      const isCurrentlyActive = item.classList.contains("active");
      
      // Close others
      items.forEach(el => setFaqItemState(el, false));
      
      // Toggle current
      setFaqItemState(item, !isCurrentlyActive);
    });
  });
}

function handleFaqSearch() {
  const query = document.getElementById("faqSearchInput").value.toLowerCase();
  const filtered = allFaqs.filter(f => 
    f.question.toLowerCase().includes(query) || 
    f.answer.toLowerCase().includes(query)
  );
  renderFaqList(filtered);
}

function filterFaq(category) {
  // Update UI
  const chips = document.querySelectorAll('.cat-chip');
  chips.forEach(c => c.classList.remove('active'));
  event.target.classList.add('active');

  const filtered = category === 'all' 
    ? allFaqs 
    : allFaqs.filter(f => (f.category || '').toLowerCase() === category);
  
  renderFaqList(filtered);
}

function renderFaqList(faqs) {
  const listRoot = document.getElementById("faq-list-root");
  if (!listRoot) return;

  if (faqs.length === 0) {
    listRoot.innerHTML = `<div style="padding:40px;text-align:center;color:#64748b;">No results found for your search.</div>`;
    return;
  }

  listRoot.innerHTML = faqs
    .map((item, i) => `
    <div class="faq-item" data-category="${escapeHtml(item.category || 'general')}">
      <button class="faq-question" type="button">
        <span>${escapeHtml(item.question)}</span>
        <span class="faq-icon"><svg class="icon" aria-hidden="true"><use xlink:href="#icon-chevron-right"></use></svg></span>
      </button>
      <div class="faq-answer">${escapeHtml(item.answer)}</div>
    </div>`)
    .join("");
  
  wireFaqAccordion(listRoot);
}

function renderFaqPage(settings) {
  const listRoot = document.getElementById("faq-list-root");
  const boardGrid = document.getElementById("about-board-grid") || document.getElementById("faq-board-grid");
  const boardTitle = document.getElementById("about-board-title") || document.getElementById("faq-board-title");

  if (!settings) return;

  // Store FAQs globally for searching/filtering
  allFaqs = Array.isArray(settings.faqs) ? settings.faqs : [];
  renderFaqList(allFaqs);

  if (boardTitle && settings.boardTitle) boardTitle.textContent = settings.boardTitle;

  if (boardGrid !== null) {
    const board = Array.isArray(settings.board) ? settings.board : [];
    boardGrid.innerHTML = board
      .map((m) => {
        const photo = m.imageUrl
          ? `<img src="${escapeHtml(m.imageUrl)}" alt="${escapeHtml(m.name)}" class="board-photo">`
          : `<div class="board-photo board-photo-placeholder" aria-hidden="true"><svg class="icon" aria-hidden="true"><use xlink:href="#icon-star"></use></svg></div>`;
        
        return `
      <article class="board-card">
        <div class="board-photo-wrap">${photo}</div>
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
    const res = await apiFetch("/api/cms/faq", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data?.settings) return;
    renderFaqPage(data.settings);
  } catch (_e) {
    // Fallback or static handling
  }
}

window.loadFaqCms = loadFaqCms;
window.handleFaqSearch = handleFaqSearch;
window.filterFaq = filterFaq;

document.addEventListener("DOMContentLoaded", () => {
  loadFaqCms();
});
