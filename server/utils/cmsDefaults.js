const DEFAULT_HOME_SETTINGS = {
  ads: [
    {
      id: "ad-1",
      imageUrl: "product-imgs/ad/ad1.png",
      title: "Discover better deals without the guesswork.",
      subtitle: "Shop curated products, compare ratings quickly, and move through checkout with confidence.",
      ctaLabel: "Shop now",
      ctaTarget: "shop",
      isActive: true,
    },
    {
      id: "ad-2",
      imageUrl: "product-imgs/ad/ad2.png",
      title: "Weekly picks built for value-focused shoppers.",
      subtitle: "Fresh offers, dependable brands, and featured products that are easy to explore.",
      ctaLabel: "View deals",
      ctaTarget: "home",
      isActive: true,
    },
    {
      id: "ad-3",
      imageUrl: "product-imgs/ad/ad3.png",
      title: "A storefront designed to feel clear and secure.",
      subtitle: "Find what you need faster, then checkout with visible trust signals and support close by.",
      ctaLabel: "Learn more",
      ctaTarget: "about",
      isActive: true,
    },
  ],
};
DEFAULT_HOME_SETTINGS.adImages = DEFAULT_HOME_SETTINGS.ads.map((ad) => ad.imageUrl);

const DEFAULT_ABOUT_SETTINGS = {
  badge: "About Blustup",
  title: "Blustup helps everyday shoppers buy with more clarity, more trust, and less friction.",
  intro:
    "We built Blustup around a simple promise: product discovery should feel transparent, checkout should feel secure, and support should be available the moment a shopper needs it. That is why the storefront combines curated catalog design, loyalty rewards, and AI-guided assistance in one place.",
  primaryCtaLabel: "Explore the shop",
  primaryCtaTarget: "shop",
  secondaryCtaLabel: "Ask Blustup AI",
  secondaryCtaTarget: "ai",
  stats: [
    {
      title: "Transparent",
      text: "Clear pricing, visible ratings, and plain-language trust signals through checkout.",
    },
    {
      title: "Helpful",
      text: "AI support, loyalty perks, and guidance that reduces checkout friction.",
    },
    {
      title: "Reliable",
      text: "A brand built around secure payments, dependable fulfillment, and customer confidence.",
    },
  ],
  cards: [
    {
      title: "Our Identity",
      text: "Blustup is positioned as a modern e-business brand for practical shoppers who want strong value without sacrificing trust. The experience blends confident visuals, curated products, and support that feels available before, during, and after purchase.",
    },
    {
      title: "Our Promise",
      text: "We focus on making every stage of online shopping easier to understand: what a product offers, how customers feel about it, and how payment and delivery choices affect the final order.",
    },
    {
      title: "Our Voice",
      text: "Helpful, direct, and practical. From the product cards to the AI assistant, the brand is designed to feel supportive rather than overwhelming.",
    },
  ],
  pillars: [
    {
      title: "What shapes the business",
      items: [
        "Product pages emphasize clear value, ratings, and short customer proof.",
        "Loyalty points encourage repeat purchases and stronger customer retention.",
        "Visible privacy and payment messaging reinforce trust at the moment it matters most.",
      ],
    },
    {
      title: "How we serve shoppers",
      items: [
        "AI chat answers product, offer, and checkout questions in real time.",
        "Secure checkout messaging keeps payment confidence front and center.",
        "Account-linked order tracking helps repeat buyers move faster on future purchases.",
      ],
    },
  ],
};

const DEFAULT_REPORT_SETTINGS = {
  emailEnabled: false,
  emailTo: "",
  emailSubjectPrefix: "Blustup Reports",
  timezone: "Africa/Accra",
  dailyCron: "0 8 * * *",
  weeklyCron: "0 9 * * 1",
  inventoryCron: "0 10 * * 1",
  history: [],
  lastRunByType: {
    daily: null,
    weekly: null,
    inventory: null,
  },
};

const DEFAULT_DELIVERY_SETTINGS = {
  automationEnabled: false,
  emailSubjectPrefix: "Blustup Delivery",
  dispatchIntro:
    "A customer order has been marked as shipped. Please contact the customer, confirm the delivery plan, and complete the drop-off as soon as possible.",
  riders: [],
  history: [],
  roundRobinIndex: 0,
};

const DEFAULT_ADMIN_PAGE_SETTINGS = {
  pageTitle: "Admin Dashboard",
  logoImageUrl: "logos/Layer 2.png",
  brandSubtitle: "Commerce Admin",
  sidebarStatus: "Live console",
  heroEyebrow: "Admin cockpit",
  heroTitleTemplate: "Hi, {{name}}",
  heroSubtitle: "Manage products, storefront content, and automation from one calm workspace.",
  supportEyebrow: "Customer support",
  supportTitle: "Need a quick hand?",
  supportText: "Jump to the live storefront or tune your help content without leaving the console.",
  primaryButtonLabel: "View site",
  secondaryButtonLabel: "Help content",
  accentColor: "#000000",
  linkColor: "#2f6bff",
  backgroundStartColor: "#f4f6fb",
  backgroundEndColor: "#e8eef8",
  glowColor: "#000000",
};

function normalizeString(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function normalizeHexColor(value, fallback) {
  const normalized = String(value || "").trim();
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized) ? normalized : fallback;
}

function uniqueStrings(values, { allowEmpty = false } = {}) {
  const seen = new Set();
  const items = (Array.isArray(values) ? values : [])
    .map((value) => String(value || "").trim())
    .filter((value) => {
      const token = value.toLowerCase();
      if (!value || seen.has(token)) return false;
      seen.add(token);
      return true;
    });
  if (items.length || allowEmpty) return items;
  return [];
}

function normalizeHomeAds(value = {}) {
  const sourceAds = Array.isArray(value?.ads) && value.ads.length
    ? value.ads
    : Array.isArray(value?.adImages)
      ? value.adImages.map((imageUrl, index) => ({
          id: `ad-${index + 1}`,
          imageUrl,
          title: DEFAULT_HOME_SETTINGS.ads[index]?.title || `Featured Ad ${index + 1}`,
          subtitle: DEFAULT_HOME_SETTINGS.ads[index]?.subtitle || "",
          ctaLabel: DEFAULT_HOME_SETTINGS.ads[index]?.ctaLabel || "Shop now",
          ctaTarget: DEFAULT_HOME_SETTINGS.ads[index]?.ctaTarget || "shop",
          isActive: true,
        }))
      : DEFAULT_HOME_SETTINGS.ads;

  return sourceAds
    .map((ad, index) => ({
      id: normalizeString(ad?.id, `ad-${index + 1}`),
      imageUrl: normalizeString(ad?.imageUrl, DEFAULT_HOME_SETTINGS.ads[index % DEFAULT_HOME_SETTINGS.ads.length].imageUrl),
      title: normalizeString(ad?.title, DEFAULT_HOME_SETTINGS.ads[index % DEFAULT_HOME_SETTINGS.ads.length].title),
      subtitle: normalizeString(ad?.subtitle, ""),
      ctaLabel: normalizeString(ad?.ctaLabel, "Shop now"),
      ctaTarget: normalizeString(ad?.ctaTarget, "shop"),
      isActive: ad?.isActive !== false,
    }))
    .filter((ad) => ad.imageUrl && ad.title)
    .slice(0, 10);
}

function normalizeHomeSettings(value = {}) {
  const ads = normalizeHomeAds(value);
  return {
    ads: ads.length ? ads : [...DEFAULT_HOME_SETTINGS.ads],
    adImages: (ads.length ? ads : DEFAULT_HOME_SETTINGS.ads)
      .filter((ad) => ad.isActive !== false)
      .map((ad) => ad.imageUrl),
  };
}

function normalizeAboutCards(list = [], fallback = []) {
  const items = (Array.isArray(list) ? list : fallback)
    .map((card, index) => ({
      title: normalizeString(card?.title, fallback[index]?.title || ""),
      text: normalizeString(card?.text, fallback[index]?.text || ""),
    }))
    .filter((card) => card.title && card.text)
    .slice(0, 6);

  return items.length ? items : fallback;
}

function normalizeAboutPillars(list = [], fallback = []) {
  const items = (Array.isArray(list) ? list : fallback)
    .map((pillar, index) => ({
      title: normalizeString(pillar?.title, fallback[index]?.title || ""),
      items: uniqueStrings(
        Array.isArray(pillar?.items)
          ? pillar.items
          : typeof pillar?.items === "string"
            ? pillar.items.split(/\r?\n/)
            : [],
        { allowEmpty: true }
      ).slice(0, 8),
    }))
    .filter((pillar) => pillar.title && pillar.items.length)
    .slice(0, 4);

  return items.length ? items : fallback;
}

function normalizeAboutSettings(value = {}) {
  return {
    badge: normalizeString(value?.badge, DEFAULT_ABOUT_SETTINGS.badge),
    title: normalizeString(value?.title, DEFAULT_ABOUT_SETTINGS.title),
    intro: normalizeString(value?.intro, DEFAULT_ABOUT_SETTINGS.intro),
    primaryCtaLabel: normalizeString(value?.primaryCtaLabel, DEFAULT_ABOUT_SETTINGS.primaryCtaLabel),
    primaryCtaTarget: normalizeString(value?.primaryCtaTarget, DEFAULT_ABOUT_SETTINGS.primaryCtaTarget),
    secondaryCtaLabel: normalizeString(value?.secondaryCtaLabel, DEFAULT_ABOUT_SETTINGS.secondaryCtaLabel),
    secondaryCtaTarget: normalizeString(value?.secondaryCtaTarget, DEFAULT_ABOUT_SETTINGS.secondaryCtaTarget),
    stats: normalizeAboutCards(value?.stats, DEFAULT_ABOUT_SETTINGS.stats),
    cards: normalizeAboutCards(value?.cards, DEFAULT_ABOUT_SETTINGS.cards),
    pillars: normalizeAboutPillars(value?.pillars, DEFAULT_ABOUT_SETTINGS.pillars),
  };
}

function normalizeReportHistoryItem(item = {}, index = 0) {
  return {
    id: normalizeString(item?.id, `report-${index + 1}`),
    type: normalizeString(item?.type, "manual"),
    generatedAt: normalizeString(item?.generatedAt, new Date().toISOString()),
    summary: normalizeString(item?.summary, ""),
    emailStatus: normalizeString(item?.emailStatus, "not_attempted"),
    emailTo: normalizeString(item?.emailTo, ""),
    source: normalizeString(item?.source, "system"),
    snapshot: item?.snapshot && typeof item.snapshot === "object" ? item.snapshot : {},
  };
}

function normalizeReportSettings(value = {}) {
  const history = (Array.isArray(value?.history) ? value.history : [])
    .map((item, index) => normalizeReportHistoryItem(item, index))
    .sort((left, right) => new Date(right.generatedAt).getTime() - new Date(left.generatedAt).getTime())
    .slice(0, 30);

  return {
    emailEnabled: value?.emailEnabled === true,
    emailTo: normalizeString(value?.emailTo, ""),
    emailSubjectPrefix: normalizeString(value?.emailSubjectPrefix, DEFAULT_REPORT_SETTINGS.emailSubjectPrefix),
    timezone: normalizeString(value?.timezone, DEFAULT_REPORT_SETTINGS.timezone),
    dailyCron: normalizeString(value?.dailyCron, DEFAULT_REPORT_SETTINGS.dailyCron),
    weeklyCron: normalizeString(value?.weeklyCron, DEFAULT_REPORT_SETTINGS.weeklyCron),
    inventoryCron: normalizeString(value?.inventoryCron, DEFAULT_REPORT_SETTINGS.inventoryCron),
    history,
    lastRunByType: {
      daily: value?.lastRunByType?.daily || null,
      weekly: value?.lastRunByType?.weekly || null,
      inventory: value?.lastRunByType?.inventory || null,
    },
  };
}

function normalizeDeliveryRider(item = {}, index = 0) {
  return {
    id: normalizeString(item?.id, `rider-${index + 1}`),
    name: normalizeString(item?.name, ""),
    email: normalizeString(item?.email, "").toLowerCase(),
    phone: normalizeString(item?.phone, ""),
    coverage: normalizeString(item?.coverage, ""),
    isActive: item?.isActive !== false,
  };
}

function normalizeDeliveryHistoryItem(item = {}, index = 0) {
  return {
    id: normalizeString(item?.id, `delivery-${index + 1}`),
    orderId: normalizeString(item?.orderId, ""),
    orderReference: normalizeString(item?.orderReference, ""),
    riderId: normalizeString(item?.riderId, ""),
    riderName: normalizeString(item?.riderName, ""),
    riderEmail: normalizeString(item?.riderEmail, "").toLowerCase(),
    riderPhone: normalizeString(item?.riderPhone, ""),
    coverage: normalizeString(item?.coverage, ""),
    status: normalizeString(item?.status, "pending"),
    source: normalizeString(item?.source, "system"),
    note: normalizeString(item?.note, ""),
    createdAt: normalizeString(item?.createdAt, new Date().toISOString()),
  };
}

function normalizeDeliverySettings(value = {}) {
  const riders = (Array.isArray(value?.riders) ? value.riders : [])
    .map((item, index) => normalizeDeliveryRider(item, index))
    .filter((rider) => rider.name || rider.email || rider.phone)
    .slice(0, 50);

  const history = (Array.isArray(value?.history) ? value.history : [])
    .map((item, index) => normalizeDeliveryHistoryItem(item, index))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 50);

  return {
    automationEnabled: value?.automationEnabled === true,
    emailSubjectPrefix: normalizeString(value?.emailSubjectPrefix, DEFAULT_DELIVERY_SETTINGS.emailSubjectPrefix),
    dispatchIntro: normalizeString(value?.dispatchIntro, DEFAULT_DELIVERY_SETTINGS.dispatchIntro),
    riders,
    history,
    roundRobinIndex: Math.max(0, Math.floor(Number(value?.roundRobinIndex || 0))),
  };
}

function normalizeAdminPageSettings(value = {}) {
  return {
    pageTitle: normalizeString(value?.pageTitle, DEFAULT_ADMIN_PAGE_SETTINGS.pageTitle),
    logoImageUrl: normalizeString(value?.logoImageUrl, DEFAULT_ADMIN_PAGE_SETTINGS.logoImageUrl),
    brandSubtitle: normalizeString(value?.brandSubtitle, DEFAULT_ADMIN_PAGE_SETTINGS.brandSubtitle),
    sidebarStatus: normalizeString(value?.sidebarStatus, DEFAULT_ADMIN_PAGE_SETTINGS.sidebarStatus),
    heroEyebrow: normalizeString(value?.heroEyebrow, DEFAULT_ADMIN_PAGE_SETTINGS.heroEyebrow),
    heroTitleTemplate: normalizeString(value?.heroTitleTemplate, DEFAULT_ADMIN_PAGE_SETTINGS.heroTitleTemplate),
    heroSubtitle: normalizeString(value?.heroSubtitle, DEFAULT_ADMIN_PAGE_SETTINGS.heroSubtitle),
    supportEyebrow: normalizeString(value?.supportEyebrow, DEFAULT_ADMIN_PAGE_SETTINGS.supportEyebrow),
    supportTitle: normalizeString(value?.supportTitle, DEFAULT_ADMIN_PAGE_SETTINGS.supportTitle),
    supportText: normalizeString(value?.supportText, DEFAULT_ADMIN_PAGE_SETTINGS.supportText),
    primaryButtonLabel: normalizeString(value?.primaryButtonLabel, DEFAULT_ADMIN_PAGE_SETTINGS.primaryButtonLabel),
    secondaryButtonLabel: normalizeString(value?.secondaryButtonLabel, DEFAULT_ADMIN_PAGE_SETTINGS.secondaryButtonLabel),
    accentColor: normalizeHexColor(value?.accentColor, DEFAULT_ADMIN_PAGE_SETTINGS.accentColor),
    linkColor: normalizeHexColor(value?.linkColor, DEFAULT_ADMIN_PAGE_SETTINGS.linkColor),
    backgroundStartColor: normalizeHexColor(value?.backgroundStartColor, DEFAULT_ADMIN_PAGE_SETTINGS.backgroundStartColor),
    backgroundEndColor: normalizeHexColor(value?.backgroundEndColor, DEFAULT_ADMIN_PAGE_SETTINGS.backgroundEndColor),
    glowColor: normalizeHexColor(value?.glowColor, DEFAULT_ADMIN_PAGE_SETTINGS.glowColor),
  };
}

module.exports = {
  DEFAULT_HOME_SETTINGS,
  DEFAULT_ABOUT_SETTINGS,
  DEFAULT_REPORT_SETTINGS,
  DEFAULT_DELIVERY_SETTINGS,
  DEFAULT_ADMIN_PAGE_SETTINGS,
  normalizeHomeSettings,
  normalizeAboutSettings,
  normalizeReportSettings,
  normalizeDeliverySettings,
  normalizeAdminPageSettings,
};
