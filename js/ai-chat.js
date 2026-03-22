/* Blustup assistant — matches site theme, multi-turn, quick prompts */

const CHAT_HISTORY_KEY = "blustup_ai_chat_v1";
const MAX_TURNS = 12;

let chatMessages = [];
let aiUi = { botName: "Blustup Assistant", chatEnabled: true };

function loadChatHistory() {
  try {
    const raw = sessionStorage.getItem(CHAT_HISTORY_KEY);
    if (raw) chatMessages = JSON.parse(raw);
    if (!Array.isArray(chatMessages)) chatMessages = [];
  } catch (_e) {
    chatMessages = [];
  }
}

function saveChatHistory() {
  try {
    sessionStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chatMessages.slice(-MAX_TURNS)));
  } catch (_e) {}
}

async function loadAiSettings() {
  try {
    const res = await fetch("/api/cms/ai");
    const data = await res.json();
    if (res.ok && data?.settings) {
      aiUi = { ...aiUi, ...data.settings };
    }
  } catch (_e) {}
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
}

function createChatWidget() {
  if (document.getElementById("aiChatRoot")) return;

  const root = document.createElement("div");
  root.id = "aiChatRoot";
  root.innerHTML = `
    <button type="button" id="aiChatToggle" class="ai-chat-fab" aria-expanded="false" aria-controls="aiChatPanel">
      <span class="ai-fab-icon" aria-hidden="true">✦</span>
      <span class="ai-fab-label">Help</span>
    </button>
    <div id="aiChatPanel" class="ai-chat-panel" role="dialog" aria-label="Chat assistant" hidden>
      <header class="ai-chat-head">
        <div>
          <div class="ai-chat-title" id="aiChatTitle">Assistant</div>
          <div class="ai-chat-sub">Ask about products, deals, or checkout</div>
        </div>
        <button type="button" id="aiChatClear" class="ai-chat-clear" title="Clear chat">Clear</button>
      </header>
      <div id="aiChatQuick" class="ai-chat-quick"></div>
      <div id="aiChatMessages" class="ai-chat-messages" role="log"></div>
      <div id="aiChatTyping" class="ai-chat-typing" hidden><span></span><span></span><span></span></div>
      <footer class="ai-chat-foot">
        <input id="aiChatInput" type="text" class="ai-chat-input" placeholder="Message…" autocomplete="off" />
        <button type="button" id="aiChatSend" class="ai-chat-send">Send</button>
      </footer>
    </div>
  `;
  document.body.appendChild(root);
}

function renderQuickChips() {
  const wrap = document.getElementById("aiChatQuick");
  if (!wrap) return;
  const chips = [
    { t: "Show me electronics", q: "What electronics deals do you have?" },
    { t: "Shipping & delivery", q: "How does shipping and delivery work?" },
    { t: "Go to checkout help", q: "How do I pay and place an order?" },
  ];
  wrap.innerHTML = chips
    .map(
      (c) =>
        `<button type="button" class="ai-chip" data-q="${escapeHtml(c.q).replace(/"/g, "&quot;")}">${escapeHtml(c.t)}</button>`
    )
    .join("");
}

function addMessage(role, text) {
  const el = document.getElementById("aiChatMessages");
  if (!el) return;
  const row = document.createElement("div");
  row.className = `ai-msg ai-msg-${role}`;
  row.innerHTML = `<div class="ai-msg-bubble">${escapeHtml(text)}</div>`;
  el.appendChild(row);
  el.scrollTop = el.scrollHeight;
}

function setTyping(on) {
  const t = document.getElementById("aiChatTyping");
  if (t) t.hidden = !on;
}

async function sendChatMessage(prefill) {
  if (!aiUi.chatEnabled) {
    addMessage("assistant", "Chat is turned off by the store admin.");
    return;
  }
  const input = document.getElementById("aiChatInput");
  const text = String(prefill != null ? prefill : input?.value || "").trim();
  if (!text) return;
  if (input) input.value = "";
  addMessage("user", text);

  const payloadMessages = [...chatMessages, { role: "user", content: text }];
  chatMessages = payloadMessages;
  saveChatHistory();

  setTyping(true);
  try {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: payloadMessages.slice(-10) }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Chat failed");
    const reply = data.reply || "No response.";
    addMessage("assistant", reply);
    chatMessages.push({ role: "assistant", content: reply });
    saveChatHistory();
  } catch (e) {
    addMessage("assistant", e.message || "Chat unavailable.");
  } finally {
    setTyping(false);
  }
}

function hydrateFromHistory() {
  const el = document.getElementById("aiChatMessages");
  if (!el) return;
  el.innerHTML = "";
  if (!chatMessages.length) {
    addMessage(
      "assistant",
      `Hi — I'm ${aiUi.botName}. Search the shop, ask for recommendations, or say what you're looking for.`
    );
    return;
  }
  chatMessages.forEach((m) => {
    if (m.role === "user" || m.role === "assistant") addMessage(m.role, m.content);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadAiSettings();
  if (!aiUi.chatEnabled) return;

  loadChatHistory();
  createChatWidget();
  const title = document.getElementById("aiChatTitle");
  if (title) title.textContent = aiUi.botName || "Assistant";

  renderQuickChips();
  hydrateFromHistory();

  const toggle = document.getElementById("aiChatToggle");
  const panel = document.getElementById("aiChatPanel");
  const send = document.getElementById("aiChatSend");
  const input = document.getElementById("aiChatInput");
  const clear = document.getElementById("aiChatClear");
  const quick = document.getElementById("aiChatQuick");

  if (toggle && panel) {
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = !panel.hasAttribute("hidden");
      if (isOpen) {
        panel.setAttribute("hidden", "hidden");
        toggle.setAttribute("aria-expanded", "false");
      } else {
        panel.removeAttribute("hidden");
        toggle.setAttribute("aria-expanded", "true");
        input?.focus();
      }
    });
    document.addEventListener("click", (e) => {
      if (!panel.hasAttribute("hidden") && !panel.contains(e.target) && !toggle.contains(e.target)) {
        panel.setAttribute("hidden", "hidden");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }
  if (clear) {
    clear.addEventListener("click", () => {
      chatMessages = [];
      saveChatHistory();
      hydrateFromHistory();
    });
  }
  if (quick) {
    quick.addEventListener("click", (e) => {
      const btn = e.target.closest(".ai-chip");
      if (!btn) return;
      const q = btn.getAttribute("data-q");
      if (q) sendChatMessage(q);
    });
  }
  if (send) send.addEventListener("click", () => sendChatMessage());
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendChatMessage();
    });
  }
});
