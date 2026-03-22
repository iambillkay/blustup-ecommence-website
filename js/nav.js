  /* ── Mobile drawer ── */
  const hamburger    = document.getElementById('hamburger');
  const mobileDrawer = document.getElementById('mobileDrawer');
  const overlay      = document.getElementById('mobileOverlay');

  function openMenu() {
    hamburger.classList.add('open');
    mobileDrawer.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    hamburger.classList.remove('open');
    mobileDrawer.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  hamburger.addEventListener('click', () =>
    hamburger.classList.contains('open') ? closeMenu() : openMenu()
  );
  overlay.addEventListener('click', closeMenu);

  /* ── Sync cart count to mobile drawer ── */
  const cartCount       = document.getElementById('cart-count');
  const cartCountMobile = document.getElementById('cart-count-mobile');
  const observer = new MutationObserver(() => {
    if (cartCountMobile) cartCountMobile.textContent = cartCount.textContent;
  });
  if (cartCount) observer.observe(cartCount, { childList: true, characterData: true, subtree: true });

  /* ── Desktop search ── */
  const searchInput  = document.getElementById('searchInput');
  const searchSubmit = document.getElementById('searchSubmit');
  const searchCat    = document.getElementById('searchCategory');

  function handleSearch() {
    if (typeof runAISearch === 'function') runAISearch();
  }

  searchSubmit.addEventListener('click', handleSearch);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  });

  /* ── Mobile search ── */
  function handleMobileSearch() {
    const query = document.getElementById('mobileSearchInput')?.value.trim() || '';
    if (!query) return;
    const si = document.getElementById('searchInput');
    if (si) si.value = query;
    closeMenu();
    if (typeof runAISearch === 'function') runAISearch();
  }

  document.getElementById('mobileSearchInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleMobileSearch();
  });