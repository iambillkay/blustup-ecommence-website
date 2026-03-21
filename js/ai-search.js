async function runAISearch() {
  const input = document.getElementById("searchInput");
  const query = String(input?.value || "").trim();
  if (!query) {
    if (typeof resetProductsFromSearch === "function") resetProductsFromSearch();
    if (typeof renderProducts === "function") renderProducts("all");
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
    if (typeof setProductsFromSearch === "function") setProductsFromSearch(data.products || []);
    if (typeof showPage === "function") showPage("shop");
    if (typeof renderProducts === "function") renderProducts("all");
    if (typeof showToast === "function") showToast("🔎", `Found ${data.products?.length || 0} results`);
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

