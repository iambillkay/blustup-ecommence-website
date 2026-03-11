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
    const query    = searchInput.value.trim();
    const category = searchCat ? searchCat.value : '';
    if (!query) return;
    console.log('Search:', query, '| Category:', category || 'All');
    // TODO: wire to your search/filter logic e.g.:
    // showPage('shop'); filterProducts(query, category);
  }

  searchSubmit.addEventListener('click', handleSearch);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSearch();
  });

  /* ── Mobile search ── */
  function handleMobileSearch() {
    const query = document.getElementById('mobileSearchInput').value.trim();
    if (!query) return;
    console.log('Mobile Search:', query);
    closeMenu();
    // TODO: showPage('shop'); filterProducts(query);
  }

  document.getElementById('mobileSearchInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleMobileSearch();
  });