const CHAT_HISTORY_KEY = "blustup_ai_chat_v1";
const CHAT_OPEN_KEY = "blustup_ai_chat_open_v1";
const MAX_TURNS = 12;

let chatMessages = [];
let chatSending = false;
let chatBootstrapped = false;
let aiUi = {
  botName: "Blustup Assistant",
  chatEnabled: true,
  userPersona: "everyday online shoppers who want reliable value",
};

function loadChatHistory() {
  try {
    const raw = sessionStorage.getItem(CHAT_HISTORY_KEY);
    chatMessages = raw ? JSON.parse(raw) : [];
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

function loadChatOpenState() {
  try {
    return sessionStorage.getItem(CHAT_OPEN_KEY) === "1";
  } catch (_e) {
    return false;
  }
}

function saveChatOpenState(isOpen) {
  try {
    sessionStorage.setItem(CHAT_OPEN_KEY, isOpen ? "1" : "0");
  } catch (_e) {}
}

async function loadAiSettings() {
  try {
    const res = await apiFetch("/api/cms/ai");
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.settings) {
      aiUi = { ...aiUi, ...data.settings };
    }
  } catch (_e) {}
}

function escapeChatHtml(value) {
  return String(value ?? "")
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
      <span class="ai-fab-icon" aria-hidden="true">&#10022;</span>
      <span class="ai-fab-label">Help</span>
    </button>
    <div id="aiChatPanel" class="ai-chat-panel" role="dialog" aria-label="Chat assistant" hidden>
      <header class="ai-chat-head">
        <div>
          <div class="ai-chat-title" id="aiChatTitle">Assistant</div>
          <div class="ai-chat-sub" id="aiChatSubtitle">Ask about products, deals, or checkout</div>
        </div>
        <div class="ai-chat-head-actions">
          <button type="button" id="aiChatClear" class="ai-chat-clear" title="Clear chat">Clear</button>
          <button type="button" id="aiChatClose" class="ai-chat-close" title="Close chat" aria-label="Close chat">Close</button>
        </div>
      </header>
      <div id="aiChatQuick" class="ai-chat-quick"></div>
      <div id="aiChatMessages" class="ai-chat-messages" role="log" aria-live="polite"></div>
      <div id="aiChatTyping" class="ai-chat-typing" hidden><span></span><span></span><span></span></div>
      <footer class="ai-chat-foot">
        <input id="aiChatInput" type="text" class="ai-chat-input" placeholder="Ask about products, deals, or checkout" autocomplete="off" />
        <button type="button" id="aiChatSend" class="ai-chat-send">Send</button>
      </footer>
    </div>
  `;
  document.body.appendChild(root);
}

function bindChatEvents() {
  const toggle = document.getElementById("aiChatToggle");
  const panel = document.getElementById("aiChatPanel");
  const close = document.getElementById("aiChatClose");
  const clear = document.getElementById("aiChatClear");
  const quick = document.getElementById("aiChatQuick");
  const send = document.getElementById("aiChatSend");
  const input = document.getElementById("aiChatInput");

  toggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    setPanelOpen(panel?.hidden !== false);
  });

  close?.addEventListener("click", () => setPanelOpen(false));

  clear?.addEventListener("click", () => {
    chatMessages = [];
    saveChatHistory();
    hydrateFromHistory();
  });

  quick?.addEventListener("click", (event) => {
    const button = event.target.closest(".ai-chip");
    if (!button) return;
    const query = button.getAttribute("data-q");
    if (query) sendChatMessage(query);
  });

  send?.addEventListener("click", () => sendChatMessage());

  input?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendChatMessage();
    }
    if (event.key === "Escape") {
      setPanelOpen(false);
    }
  });

  document.addEventListener("click", (event) => {
    if (!panel || panel.hidden) return;
    if (panel.contains(event.target) || toggle?.contains(event.target)) return;
    setPanelOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && panel && !panel.hidden) {
      setPanelOpen(false);
    }
  });
}

function renderQuickChips() {
  const wrap = document.getElementById("aiChatQuick");
  if (!wrap) return;

  const chips = [
    { label: "Best deals", query: "What deals do you recommend right now?" },
    { label: "Find electronics", query: "Show me electronics or gadget recommendations." },
    { label: "Checkout help", query: "How do I place an order and pay?" },
  ];

  wrap.innerHTML = chips
    .map(
      (chip) =>
        `<button type="button" class="ai-chip" data-q="${escapeChatHtml(chip.query)}">${escapeChatHtml(chip.label)}</button>`
    )
    .join("");
}

function setPanelOpen(isOpen) {
  const panel = document.getElementById("aiChatPanel");
  const toggle = document.getElementById("aiChatToggle");
  const input = document.getElementById("aiChatInput");
  if (!panel || !toggle) return;

  panel.hidden = !isOpen;
  toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  saveChatOpenState(isOpen);

  if (isOpen) input?.focus();
}

function updateChatHeader() {
  const title = document.getElementById("aiChatTitle");
  const subtitle = document.getElementById("aiChatSubtitle");
  if (title) title.textContent = aiUi.botName || "Assistant";
  if (subtitle) subtitle.textContent = "Ask about products, deals, or checkout";
}

function addMessage(role, text) {
  const list = document.getElementById("aiChatMessages");
  if (!list) return;
  const row = document.createElement("div");
  row.className = `ai-msg ai-msg-${role} animate-fade-in`;
  row.innerHTML = `<div class="ai-msg-bubble">${escapeChatHtml(text)}</div>`;
  list.appendChild(row);
  list.scrollTop = list.scrollHeight;
}

function hydrateFromHistory() {
  const list = document.getElementById("aiChatMessages");
  if (!list) return;

  list.innerHTML = "";
  if (!chatMessages.length) {
    addMessage(
      "assistant",
      `Hi, I'm ${aiUi.botName}. I can help you discover products, compare options, and answer checkout questions.`
    );
    return;
  }

  chatMessages.forEach((message) => {
    if (message.role === "user" || message.role === "assistant") {
      addMessage(message.role, message.content);
    }
  });
}

function setTyping(isTyping) {
  const typing = document.getElementById("aiChatTyping");
  if (typing) typing.hidden = !isTyping;
}

function setComposerDisabled(disabled) {
  const input = document.getElementById("aiChatInput");
  const send = document.getElementById("aiChatSend");
  if (input) input.disabled = disabled;
  if (send) {
    send.disabled = disabled;
    send.textContent = disabled ? "Sending..." : "Send";
  }
}

async function sendChatMessage(prefill) {
  if (chatSending) return;
  if (!aiUi.chatEnabled) {
    addMessage("assistant", "Chat is turned off by the store admin.");
    return;
  }

  const input = document.getElementById("aiChatInput");
  const text = String(prefill != null ? prefill : input?.value || "").trim();
  if (!text) return;

  if (input && prefill == null) input.value = "";
  addMessage("user", text);
  setPanelOpen(true);

  chatMessages = [...chatMessages, { role: "user", content: text }].slice(-MAX_TURNS);
  saveChatHistory();

  chatSending = true;
  setTyping(true);
  setComposerDisabled(true);

  try {
    const res = await apiFetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: chatMessages.slice(-10) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Chat failed");

    const reply = data.reply || "I could not generate a response right now.";
    addMessage("assistant", reply);
    chatMessages = [...chatMessages, { role: "assistant", content: reply }].slice(-MAX_TURNS);
    saveChatHistory();
  } catch (error) {
    addMessage("assistant", error.message || "Chat is unavailable right now.");
  } finally {
    chatSending = false;
    setTyping(false);
    setComposerDisabled(false);
    input?.focus();
  }
}

async function initializeAiChat() {
  await loadAiSettings();
  if (!aiUi.chatEnabled) return false;

  loadChatHistory();
  createChatWidget();
  updateChatHeader();
  renderQuickChips();
  hydrateFromHistory();

  if (loadChatOpenState()) setPanelOpen(true);
  if (!chatBootstrapped) {
    bindChatEvents();
    chatBootstrapped = true;
  }
  return true;
}

async function openAiChat(prefill = "") {
  const ready = await initializeAiChat();
  if (!ready) {
    if (typeof showToast === "function") showToast('<svg class="icon" aria-hidden="true"><use xlink:href="#icon-error"></use></svg>', "AI chat is unavailable right now.");
    return false;
  }

  setPanelOpen(true);
  const input = document.getElementById("aiChatInput");
  if (input && prefill) input.value = String(prefill);
  input?.focus();
  return true;
}

window.openAiChat = openAiChat;
window.closeAiChat = () => setPanelOpen(false);

document.addEventListener("DOMContentLoaded", async () => {
  await initializeAiChat();
});
