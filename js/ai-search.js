async function runAISearch() {
  const input = document.getElementById("searchInput");
  const searchCat = document.getElementById("searchCategory");
  const query = String(input?.value || "").trim();
  const category = searchCat ? String(searchCat.value || "").trim() : "";

  if (!query) {
    if (typeof resetProductsFromSearch === "function") resetProductsFromSearch();
    if (typeof showPage === "function") showPage("shop");
    if (typeof window.setShopFilter === "function") window.setShopFilter(category || "all");
    else if (typeof renderProducts === "function") renderProducts(category || "all");
    return;
  }

  try {
    const res = await fetch("/api/ai/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "AI search failed");
    let found = data.products || [];
    if (category) {
      found = found.filter((p) => p.cat === category);
    }
    if (typeof setProductsFromSearch === "function") setProductsFromSearch(found);
    if (typeof showPage === "function") showPage("shop");
    if (typeof window.setShopFilter === "function") window.setShopFilter(category || "all");
    else if (typeof renderProducts === "function") renderProducts(category || "all");
    if (typeof showToast === "function") {
      showToast("🔎", found.length ? `Found ${found.length} result(s)` : "No matches in that category");
    }
  } catch (e) {
    if (typeof showToast === "function") showToast("⚠️", e.message || "AI search failed");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const submitBtn = document.getElementById("searchSubmit");
  const input = document.getElementById("searchInput");
  if (submitBtn) submitBtn.addEventListener("click", runAISearch);
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        runAISearch();
      }
    });
  }
});
