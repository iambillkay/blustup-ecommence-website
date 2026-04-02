const { z } = require("zod");
const storage = require("../storage");

const AI_CURRENCY_SYMBOL = "\u20B5";
const DEFAULT_AI_SETTINGS = {
  chatEnabled: true,
  searchEnabled: true,
  botName: "Blustup AI",
  userPersona: "everyday online shoppers in Ghana who want reliable value and clear guidance",
  systemPrompt:
    "You are Blustup's shopping assistant. Give brief, direct answers. Recommend products when relevant.",
};

const productDescriptionSchema = z.object({
  name: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(80).optional().default("general"),
  categories: z.array(z.string().trim().min(1).max(80)).max(12).optional().default([]),
  currentDescription: z.string().trim().max(5000).optional().default(""),
  badge: z.string().trim().max(80).optional().default(""),
  price: z.preprocess(
    (value) => (value === "" || value == null ? undefined : Number(value)),
    z.number().min(0).optional()
  ),
  stockQty: z.preprocess(
    (value) => (value === "" || value == null ? undefined : Number(value)),
    z.number().min(0).optional()
  ),
});

const searchSchema = z.object({
  query: z.string().trim().min(1).max(200),
  category: z.string().trim().max(80).optional().default(""),
});

function normalizeCategoryToken(value) {
  return String(value || "").trim().toLowerCase();
}

function getProductCategories(product) {
  const source = Array.isArray(product?.categories) ? product.categories : [product?.cat];
  const seen = new Set();
  return source
    .map((value) => String(value || "").trim())
    .filter((value) => {
      const token = normalizeCategoryToken(value);
      if (!value || seen.has(token)) return false;
      seen.add(token);
      return true;
    });
}

function normalizeAiSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    chatEnabled: source.chatEnabled !== false,
    searchEnabled: source.searchEnabled !== false,
    botName: String(source.botName || DEFAULT_AI_SETTINGS.botName).trim() || DEFAULT_AI_SETTINGS.botName,
    userPersona:
      String(source.userPersona || DEFAULT_AI_SETTINGS.userPersona).trim() || DEFAULT_AI_SETTINGS.userPersona,
    systemPrompt:
      String(source.systemPrompt || DEFAULT_AI_SETTINGS.systemPrompt).trim() || DEFAULT_AI_SETTINGS.systemPrompt,
  };
}

async function getAiSettings() {
  return normalizeAiSettings(await storage.cms.getAi());
}

function hasOpenAI() {
  return Boolean(process.env.OPENAI_API_KEY);
}

async function callOpenAIChat(messages, systemPrompt, options = {}) {
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const apiKey = process.env.OPENAI_API_KEY;
  const payload = {
    model,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 180,
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
  const name = String(product?.name || "").toLowerCase();
  const description = String(product?.desc || "").toLowerCase();
  const categories = getProductCategories(product).map((value) => value.toLowerCase());
  const hay = `${name} ${description} ${categories.join(" ")}`.toLowerCase();
  if (!q) return 0;

  if (name === q) return 30;
  if (name.startsWith(q)) return 24;
  if (categories.includes(q)) return 20;
  if (hay.includes(q)) return 12;

  const parts = q.split(/\s+/).filter(Boolean);
  return parts.reduce((score, part) => {
    if (name.includes(part)) return score + 5;
    if (categories.some((category) => category.includes(part))) return score + 4;
    if (description.includes(part)) return score + 2;
    return score;
  }, 0);
}

function formatAiMoney(value) {
  const amount = Number(value || 0);
  return `${AI_CURRENCY_SYMBOL}${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
}

function humanizeCategory(value) {
  return String(value || "")
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function cleanText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();
}

async function listCatalogProducts(limit = 120) {
  try {
    const data = await storage.product.listPublic({
      page: 1,
      limit,
      q: "",
      category: undefined,
      minPrice: null,
      maxPrice: null,
    });
    return Array.isArray(data?.products) ? data.products : [];
  } catch (_e) {
    return [];
  }
}

function buildCatalogContext(products) {
  const lines = (products || []).slice(0, 40).map((product) =>
    `- ${product.name} - ${formatAiMoney(product.price)} - categories: ${getProductCategories(product).join(", ")}${
      product.stockQty != null ? ` - stock: ${product.stockQty}` : ""
    }`
  );
  return lines.length ? `Current catalog (use for accurate answers):\n${lines.join("\n")}` : "";
}

function listCategoryLabels(products) {
  const seen = new Set();
  const labels = [];

  (products || []).forEach((product) => {
    getProductCategories(product).forEach((raw) => {
      const token = normalizeCategoryToken(raw);
      if (!raw || !token || seen.has(token)) return;
      seen.add(token);
      labels.push(humanizeCategory(raw));
    });
  });

  return labels;
}

function findMatchingProducts(query, products, options = {}) {
  const categoryToken = normalizeCategoryToken(options.category);
  return [...(products || [])]
    .map((product) => {
      let score = scoreProduct(product, query);
      if (categoryToken && getProductCategories(product).some((value) => normalizeCategoryToken(value) === categoryToken)) score += 4;
      return { product, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.product)
    .slice(0, options.limit || 3);
}

function formatProductSuggestion(product) {
  return `${product.name} (${formatAiMoney(product.price)}, ${humanizeCategory(getProductCategories(product)[0] || "general")})`;
}

function buildFallbackChatReply(message, aiSettings, products) {
  const latest = String(message || "").toLowerCase();
  const categories = listCategoryLabels(products);
  const matches = findMatchingProducts(latest, products, { limit: 3 });

  if (/\b(hello|hi|hey)\b/.test(latest)) {
    return `Hi, I'm ${aiSettings.botName}. I help ${aiSettings.userPersona} find products, compare options, and understand checkout.`;
  }

  if (/(shipping|delivery|track)/.test(latest)) {
    return "Shipping and delivery charges appear at checkout. Add items to your cart, then open Checkout to review delivery, tax, and your final total before paying.";
  }

  if (/(cart|checkout|pay|payment|order)/.test(latest)) {
    return "Open Cart from the header, review your items, then continue to Checkout to enter delivery details and complete payment.";
  }

  if (/(category|categories|browse|shop|collection)/.test(latest) && categories.length) {
    const labelPreview = categories.slice(0, 5).join(", ");
    return `You can browse ${labelPreview}${categories.length > 5 ? ", and more" : ""}. Tell me what type of product you want and I will narrow it down.`;
  }

  if (matches.length) {
    return `A few strong matches are ${matches.map(formatProductSuggestion).join(", ")}. Tell me if you want the cheapest option, a premium pick, or more from the same category.`;
  }

  return "I can help with product recommendations, categories, deals, and checkout. Try asking for a product type, a budget, or a category.";
}

function buildDescriptionFacts(input, aiSettings) {
  const categories = input.categories.length ? input.categories : [input.category || "general"];
  const parts = [
    `Product name: ${input.name}.`,
    `Categories: ${categories.map(humanizeCategory).join(", ")}.`,
    `Audience persona: ${aiSettings.userPersona}.`,
  ];

  if (input.badge) parts.push(`Badge or promotion: ${input.badge}.`);
  if (Number.isFinite(input.price)) parts.push(`Price: ${formatAiMoney(input.price)}.`);
  if (Number.isFinite(input.stockQty)) parts.push(`Stock available: ${input.stockQty}.`);
  if (input.currentDescription) parts.push(`Existing draft to improve: ${input.currentDescription}`);

  return parts.join(" ");
}

function buildFallbackDescription(input, aiSettings) {
  const categories = input.categories.length ? input.categories : [input.category || "general"];
  const category = humanizeCategory(categories[0]).toLowerCase();
  const parts = [`${input.name} is a ${category} option designed for dependable everyday use and easy comparison while shopping online.`];

  if (input.badge) {
    parts.push(`It stands out with ${String(input.badge).toLowerCase()} appeal and a clear value story for ${aiSettings.userPersona}.`);
  } else if (Number.isFinite(input.price)) {
    parts.push(`Priced at ${formatAiMoney(input.price)}, it offers a practical balance of presentation, usefulness, and value.`);
  } else {
    parts.push(`It gives shoppers a clear, trustworthy choice with a practical balance of function and value.`);
  }

  if (Number.isFinite(input.stockQty) && input.stockQty > 0) {
    parts.push("Available stock is ready for new orders.");
  }

  return cleanText(parts.join(" "));
}

async function chat(req, res) {
  const aiSettings = await getAiSettings();
  if (!aiSettings.chatEnabled) return res.status(403).json({ error: "AI chat is disabled by admin" });

  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  if (!messages.length) return res.status(400).json({ error: "messages array is required" });

  const latest = String(messages[messages.length - 1]?.content || "").trim();
  const catalogProducts = await listCatalogProducts(80);
  const catalog = buildCatalogContext(catalogProducts);
  const systemPrompt = [
    aiSettings.systemPrompt,
    `Primary shopper persona: ${aiSettings.userPersona}.`,
    "Reply in 1-3 short sentences. Be direct, clear, and helpful.",
    catalog,
  ]
    .filter(Boolean)
    .join("\n\n");

  if (hasOpenAI()) {
    try {
      const content = cleanText(await callOpenAIChat(messages, systemPrompt));
      if (content) return res.json({ reply: content, provider: "openai" });
    } catch (_e) {}
  }

  return res.json({
    reply: buildFallbackChatReply(latest, aiSettings, catalogProducts),
    provider: "fallback",
  });
}

async function search(req, res) {
  const parsed = searchSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });

  const aiSettings = await getAiSettings();
  const categoryToken = normalizeCategoryToken(parsed.data.category) === "all"
    ? ""
    : normalizeCategoryToken(parsed.data.category);
  const products = await listCatalogProducts(200);
  const scopedProducts = categoryToken
    ? products.filter((product) => getProductCategories(product).some((value) => normalizeCategoryToken(value) === categoryToken))
    : products;

  if (!aiSettings.searchEnabled) {
    const basic = scopedProducts.filter((product) => scoreProduct(product, parsed.data.query) > 0).slice(0, 40);
    return res.json({ query: parsed.data.query, category: parsed.data.category, products: basic, provider: "basic" });
  }

  const ranked = findMatchingProducts(parsed.data.query, scopedProducts, {
    category: categoryToken,
    limit: 40,
  });

  return res.json({
    query: parsed.data.query,
    category: parsed.data.category,
    products: ranked,
    provider: hasOpenAI() ? "hybrid" : "fallback",
  });
}

async function suggestProductDescription(req, res) {
  const parsed = productDescriptionSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
  }

  const aiSettings = await getAiSettings();
  const input = parsed.data;

  if (hasOpenAI()) {
    try {
      const prompt = [
        "Write one concise ecommerce product description.",
        "Use only the provided facts.",
        "Keep it between 28 and 55 words.",
        "No markdown, no bullet points, no exaggerated claims, and no invented specs.",
        buildDescriptionFacts(input, aiSettings),
      ].join("\n");

      const description = cleanText(
        await callOpenAIChat(
          [{ role: "user", content: prompt }],
          `You write polished ecommerce product descriptions for Blustup. Keep the tone clear, modern, and trustworthy for ${aiSettings.userPersona}.`,
          { temperature: 0.45, maxTokens: 120 }
        )
      );

      if (description) {
        return res.json({ description, provider: "openai" });
      }
    } catch (_e) {}
  }

  return res.json({
    description: buildFallbackDescription(input, aiSettings),
    provider: "fallback",
  });
}

module.exports = { chat, search, suggestProductDescription };
