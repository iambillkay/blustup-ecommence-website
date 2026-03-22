const storage = require("../storage");

function hasOpenAI() {
  return Boolean(process.env.OPENAI_API_KEY);
}

async function callOpenAIChat(messages, systemPrompt) {
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const apiKey = process.env.OPENAI_API_KEY;
  const payload = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    temperature: 0.3,
    max_tokens: 180,
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data?.error?.message || "OpenAI request failed");
  return data?.choices?.[0]?.message?.content || "";
}

function scoreProduct(product, query) {
  const q = String(query || "").toLowerCase();
  const hay = `${product.name} ${product.desc} ${product.cat}`.toLowerCase();
  if (!q) return 0;
  if (hay.includes(q)) return 10;
  const parts = q.split(/\s+/).filter(Boolean);
  return parts.reduce((n, p) => n + (hay.includes(p) ? 2 : 0), 0);
}

async function buildCatalogContext() {
  try {
    const data = await storage.product.listPublic({
      page: 1,
      limit: 40,
      q: "",
      category: undefined,
      minPrice: null,
      maxPrice: null,
    });
    const lines = (data.products || []).map(
      (p) => `- ${p.name} — $${Number(p.price).toFixed(2)} — category: ${p.cat}${p.stockQty != null ? ` — stock: ${p.stockQty}` : ""}`
    );
    return lines.length ? `Current catalog (use for accurate answers):\n${lines.join("\n")}` : "";
  } catch (_e) {
    return "";
  }
}

async function chat(req, res) {
  const aiSettings = await storage.cms.getAi();
  if (!aiSettings?.chatEnabled) return res.status(403).json({ error: "AI chat is disabled by admin" });

  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  if (!messages.length) return res.status(400).json({ error: "messages array is required" });

  try {
    const catalog = await buildCatalogContext();
    const systemPrompt = `${aiSettings.systemPrompt}\n\nReply in 1-3 short sentences. Be direct and helpful.\n${catalog}`;

    if (hasOpenAI()) {
      const content = await callOpenAIChat(messages, systemPrompt);
      return res.json({ reply: content, provider: "openai" });
    }

    const latest = String(messages[messages.length - 1]?.content || "").toLowerCase();
    let reply = `${aiSettings.botName}: Try the Shop page to browse categories, or tell me a product type (for example Oraimo, earphones, or power bank).`;
    if (/(shipping|delivery|order|track)/.test(latest)) {
      reply = `${aiSettings.botName}: Standard delivery is shown at checkout. Add items to your cart, then open Checkout to review shipping and tax before paying.`;
    } else if (/(cart|checkout|pay|payment)/.test(latest)) {
      reply = `${aiSettings.botName}: Open Cart from the header, apply a promo if you have one, then proceed to Checkout to enter details and pay.`;
    } else if (/(hello|hi|hey)/.test(latest)) {
      reply = `${aiSettings.botName}: Hi! I can help you find products, compare categories, or explain checkout. What are you looking for today?`;
    }
    return res.json({ reply, provider: "fallback" });
  } catch (e) {
    return res.status(502).json({ error: e.message || "AI chat failed" });
  }
}

async function search(req, res) {
  const aiSettings = await storage.cms.getAi();
  const query = String(req.body?.query || "").trim();
  if (!query) return res.status(400).json({ error: "query is required" });

  const data = await storage.product.listPublic({ page: 1, limit: 200, q: "", category: undefined, minPrice: null, maxPrice: null });
  const products = [...(data.products || [])];

  if (!aiSettings?.searchEnabled) {
    const basic = products.filter((p) => scoreProduct(p, query) > 0);
    return res.json({ query, products: basic.slice(0, 40), provider: "basic" });
  }

  const ranked = products
    .map((p) => ({ p, s: scoreProduct(p, query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p)
    .slice(0, 40);

  return res.json({ query, products: ranked, provider: hasOpenAI() ? "hybrid" : "fallback" });
}

module.exports = { chat, search };

