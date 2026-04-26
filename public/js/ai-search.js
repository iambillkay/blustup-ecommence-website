function normalizeSearchCategoryToken(value) {
  return String(value || "").trim().toLowerCase();
}

function getSearchProductCategories(product) {
  const source = Array.isArray(product?.categories) ? product.categories : [product?.cat];
  const seen = new Set();
  return source
    .map((value) => String(value || "").trim())
    .filter((value) => {
      const token = normalizeSearchCategoryToken(value);
      if (!value || seen.has(token)) return false;
      seen.add(token);
      return true;
    });
}

function scoreLocalSearchProduct(product, query) {
  const needle = String(query || "").trim().toLowerCase();
  const name = String(product?.name || "").toLowerCase();
  const desc = String(product?.desc || "").toLowerCase();
  const categories = getSearchProductCategories(product).map((value) => value.toLowerCase());
  const haystack = `${name} ${desc} ${categories.join(" ")}`.toLowerCase();
  if (!needle) return 0;
  if (name === needle) return 30;
  if (name.startsWith(needle)) return 24;
  if (categories.includes(needle)) return 20;
  if (haystack.includes(needle)) return 12;
  return needle
    .split(/\s+/)
    .filter(Boolean)
    .reduce((score, part) => {
      if (name.includes(part)) return score + 5;
      if (categories.some((category) => category.includes(part))) return score + 4;
      if (desc.includes(part)) return score + 2;
      return score;
    }, 0);
}

function runLocalSearch(query, category) {
  const categoryToken = normalizeSearchCategoryToken(category);
  const catalog = Array.isArray(allProducts) ? allProducts : Array.isArray(products) ? products : [];
  return [...catalog]
    .filter((product) => {
      if (!categoryToken || categoryToken === "all") return true;
      return getSearchProductCategories(product).some((value) => normalizeSearchCategoryToken(value) === categoryToken);
    })
    .map((product) => ({ product, score: scoreLocalSearchProduct(product, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.product);
}

function showSearchResults(found, category, source = "search") {
  if (typeof setProductsFromSearch === "function") setProductsFromSearch(found);
  if (typeof showPage === "function") showPage("shop");
  if (typeof window.setShopFilter === "function") window.setShopFilter(category || "all");
  else if (typeof renderProducts === "function") renderProducts(category || "all");

  if (typeof showToast === "function") {
    const prefix = source === "local" ? "Local" : "Found";
    showToast("i", found.length ? `${prefix} ${found.length} result(s)` : "No matches found yet");
  }
}

async function runAISearch() {
  const input = document.getElementById("searchInput");
  const searchCategory = document.getElementById("searchCategory");
  const query = String(input?.value || "").trim();
  const category = String(searchCategory?.value || "").trim();

  if (!query) {
    if (typeof resetProductsFromSearch === "function") resetProductsFromSearch();
    if (typeof showPage === "function") showPage("shop");
    if (typeof window.setShopFilter === "function") window.setShopFilter(category || "all");
    else if (typeof renderProducts === "function") renderProducts(category || "all");
    return;
  }

  try {
    const res = await apiFetch("/api/ai/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, category: category || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "AI search failed");

    let found = Array.isArray(data.products) ? data.products : [];
    if (category && normalizeSearchCategoryToken(category) !== "all") {
      const categoryToken = normalizeSearchCategoryToken(category);
      found = found.filter((product) =>
        getSearchProductCategories(product).some((value) => normalizeSearchCategoryToken(value) === categoryToken)
      );
    }

    if (!found.length) {
      const localFound = runLocalSearch(query, category);
      if (localFound.length) {
        showSearchResults(localFound, category, "local");
        return;
      }
    }

    showSearchResults(found, category);
  } catch (error) {
    const localFound = runLocalSearch(query, category);
    if (localFound.length) {
      showSearchResults(localFound, category, "local");
      return;
    }
    if (typeof showToast === "function") showToast('<svg class="icon" aria-hidden="true"><use xlink:href="#icon-error"></use></svg>', error.message || "Search failed");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const submitButton = document.getElementById("searchSubmit");
  const input = document.getElementById("searchInput");
  const searchCategory = document.getElementById("searchCategory");

  submitButton?.addEventListener("click", runAISearch);
  input?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runAISearch();
    }
  });
  searchCategory?.addEventListener("change", () => {
    const query = String(input?.value || "").trim();
    if (query) {
      runAISearch();
      return;
    }
    if (typeof showPage === "function") showPage("shop");
    if (typeof window.setShopFilter === "function") window.setShopFilter(searchCategory.value || "all");
  });
});
