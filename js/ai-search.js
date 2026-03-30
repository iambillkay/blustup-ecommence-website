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

    if (typeof setProductsFromSearch === "function") setProductsFromSearch(found);
    if (typeof showPage === "function") showPage("shop");
    if (typeof window.setShopFilter === "function") window.setShopFilter(category || "all");
    else if (typeof renderProducts === "function") renderProducts(category || "all");

    if (typeof showToast === "function") {
      showToast("i", found.length ? `Found ${found.length} result(s)` : "No matches found yet");
    }
  } catch (error) {
    if (typeof showToast === "function") showToast("!", error.message || "AI search failed");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const submitButton = document.getElementById("searchSubmit");
  const input = document.getElementById("searchInput");

  submitButton?.addEventListener("click", runAISearch);
  input?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runAISearch();
    }
  });
});
