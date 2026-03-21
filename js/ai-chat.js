function createChatWidget() {
  if (document.getElementById("aiChatRoot")) return;

  const root = document.createElement("div");
  root.id = "aiChatRoot";
  root.innerHTML = `
    <button id="aiChatToggle" style="position:fixed;right:18px;bottom:18px;z-index:9999;padding:10px 14px;border:none;border-radius:999px;background:#5a67ff;color:#fff;cursor:pointer;font-weight:700;">AI Chat</button>
    <div id="aiChatPanel" style="display:none;position:fixed;right:18px;bottom:68px;width:320px;max-height:460px;z-index:9999;background:#fff;border:1px solid #e6e8f5;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.12);overflow:hidden;">
      <div style="padding:10px 12px;border-bottom:1px solid #ecefff;font-weight:700;">Blustup AI Assistant</div>
      <div id="aiChatMessages" style="padding:10px;height:320px;overflow:auto;font-size:.92rem;"></div>
      <div style="display:flex;gap:8px;padding:10px;border-top:1px solid #ecefff;">
        <input id="aiChatInput" type="text" placeholder="Ask about products..." style="flex:1;padding:8px;border:1px solid #d9def5;border-radius:8px;">
        <button id="aiChatSend" style="padding:8px 12px;border:none;border-radius:8px;background:#5a67ff;color:#fff;cursor:pointer;">Send</button>
      </div>
    </div>
  `;
  document.body.appendChild(root);
}

function addMessage(role, text) {
  const el = document.getElementById("aiChatMessages");
  if (!el) return;
  const row = document.createElement("div");
  row.style.marginBottom = "8px";
  row.innerHTML = `<div style="display:inline-block;padding:8px 10px;border-radius:10px;max-width:92%;${role === "user" ? "background:#e8ebff;margin-left:auto;" : "background:#f5f7ff;"}">${text}</div>`;
  el.appendChild(row);
  el.scrollTop = el.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById("aiChatInput");
  const text = String(input?.value || "").trim();
  if (!text) return;
  input.value = "";
  addMessage("user", text);
  try {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: text }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Chat failed");
    addMessage("assistant", data.reply || "No response");
  } catch (e) {
    addMessage("assistant", e.message || "Chat unavailable");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  createChatWidget();
  const toggle = document.getElementById("aiChatToggle");
  const panel = document.getElementById("aiChatPanel");
  const send = document.getElementById("aiChatSend");
  const input = document.getElementById("aiChatInput");
  if (toggle && panel) {
    toggle.addEventListener("click", () => {
      panel.style.display = panel.style.display === "none" ? "block" : "none";
    });
  }
  if (send) send.addEventListener("click", sendChatMessage);
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendChatMessage();
    });
  }
});

