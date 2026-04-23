const hamburger = document.getElementById("hamburger");
const mobileDrawer = document.getElementById("mobileDrawer");
const overlay = document.getElementById("mobileOverlay");
const cartCount = document.getElementById("cart-count");
const cartCountMobile = document.getElementById("cart-count-mobile");
const mobileSearchInput = document.getElementById("mobileSearchInput");

function setMenuState(isOpen) {
  if (!hamburger || !mobileDrawer || !overlay) return;
  hamburger.classList.toggle("open", isOpen);
  hamburger.setAttribute("aria-expanded", String(isOpen));
  mobileDrawer.classList.toggle("open", isOpen);
  overlay.classList.toggle("open", isOpen);
  document.body.classList.toggle("menu-open", isOpen);
  document.body.style.overflow = isOpen ? "hidden" : "";
}

function openMenu() {
  setMenuState(true);
}

function closeMenu() {
  setMenuState(false);
}

function handleMobileSearch() {
  const query = mobileSearchInput?.value.trim() || "";
  if (!query) return;

  const desktopInput = document.getElementById("searchInput");
  if (desktopInput) desktopInput.value = query;

  closeMenu();
  if (typeof runAISearch === "function") runAISearch();
}

function syncMobileCartCount() {
  if (!cartCount || !cartCountMobile) return;
  cartCountMobile.textContent = cartCount.textContent;
}

window.openMenu = openMenu;
window.closeMenu = closeMenu;
window.handleMobileSearch = handleMobileSearch;

hamburger?.addEventListener("click", () => {
  if (hamburger.classList.contains("open")) closeMenu();
  else openMenu();
});

overlay?.addEventListener("click", closeMenu);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && hamburger?.classList.contains("open")) {
    closeMenu();
  }
});

mobileSearchInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleMobileSearch();
  }
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 960 && hamburger?.classList.contains("open")) {
    closeMenu();
  }
});

if (cartCount && cartCountMobile) {
  const observer = new MutationObserver(syncMobileCartCount);
  observer.observe(cartCount, { childList: true, characterData: true, subtree: true });
  syncMobileCartCount();
}
