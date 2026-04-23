const storage = require("../storage");

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function toDate(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function startOfDay(value) {
  const date = toDate(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value) {
  const date = startOfDay(value);
  date.setDate(date.getDate() + 1);
  date.setMilliseconds(-1);
  return date;
}

function addDays(value, amount) {
  const date = toDate(value);
  date.setDate(date.getDate() + Number(amount || 0));
  return date;
}

function formatDayLabel(value) {
  return startOfDay(value).toISOString().slice(0, 10);
}

function toPercent(current, previous) {
  if (!previous && !current) return 0;
  if (!previous) return 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function getSessionKey(entry = {}) {
  if (entry.sessionId) return `session:${entry.sessionId}`;
  if (entry.userId) return `user:${entry.userId}`;
  return null;
}

function getOrderRows(orders = []) {
  return (orders || []).filter((order) => String(order?.status || "").trim().toLowerCase() !== "cancelled");
}

function getOrderItems(order) {
  return Array.isArray(order?.items) ? order.items : [];
}

function getProductMap(products = []) {
  return new Map((products || []).map((product) => [String(product?.id || ""), product]));
}

function withinRange(value, start, end) {
  const time = toDate(value).getTime();
  return time >= toDate(start).getTime() && time <= toDate(end).getTime();
}

function buildRevenueSeries(orders, startDate, days) {
  const buckets = new Map();
  for (let index = 0; index < days; index += 1) {
    const day = addDays(startDate, index);
    buckets.set(formatDayLabel(day), { date: formatDayLabel(day), revenue: 0, orders: 0 });
  }

  orders.forEach((order) => {
    const key = formatDayLabel(order.createdAt);
    const bucket = buckets.get(key);
    if (!bucket) return;
    bucket.revenue = roundMoney(bucket.revenue + Number(order.total || 0));
    bucket.orders += 1;
  });

  return [...buckets.values()];
}

function buildTopProducts(orders, productMap, startDate) {
  const totals = new Map();
  orders
    .filter((order) => toDate(order.createdAt).getTime() >= toDate(startDate).getTime())
    .forEach((order) => {
      getOrderItems(order).forEach((item) => {
        const key = String(item.productId || "");
        const current = totals.get(key) || { productId: key, unitsSold: 0, revenue: 0 };
        current.unitsSold += Number(item.qty || 0);
        current.revenue = roundMoney(current.revenue + Number(item.price || 0) * Number(item.qty || 0));
        totals.set(key, current);
      });
    });

  return [...totals.values()]
    .map((entry) => ({
      ...entry,
      name: productMap.get(entry.productId)?.name || "Unknown product",
    }))
    .sort((left, right) => right.revenue - left.revenue)
    .slice(0, 5);
}

function buildFunnel(trackingEvents, orders, sinceDate) {
  const recentEvents = (trackingEvents || []).filter((entry) => toDate(entry.createdAt).getTime() >= toDate(sinceDate).getTime());
  const pageViews = recentEvents.filter((entry) => String(entry.eventType || "").trim().toLowerCase() === "pageview");
  const productViews = recentEvents.filter((entry) => String(entry.eventType || "").trim().toLowerCase() === "product_view");
  const addToCart = recentEvents.filter((entry) => String(entry.eventType || "").trim().toLowerCase() === "add_to_cart");
  const purchaseSessions = new Set(
    (orders || [])
      .filter((order) => toDate(order.createdAt).getTime() >= toDate(sinceDate).getTime())
      .map((order) => (order.sessionId ? `session:${order.sessionId}` : order.userId ? `user:${order.userId}` : `order:${order.reference}`))
  );

  const uniqueSessions = (events) => new Set(events.map(getSessionKey).filter(Boolean));
  const pageSessions = uniqueSessions(pageViews);
  const productSessions = uniqueSessions(productViews);
  const cartSessions = uniqueSessions(addToCart);

  const viewToCartPercent = productSessions.size ? Math.round((cartSessions.size / productSessions.size) * 1000) / 10 : 0;
  const cartToPurchasePercent = cartSessions.size ? Math.round((purchaseSessions.size / cartSessions.size) * 1000) / 10 : 0;
  const viewToPurchasePercent = productSessions.size ? Math.round((purchaseSessions.size / productSessions.size) * 1000) / 10 : 0;

  return {
    pageViews: pageViews.length,
    productViews: productViews.length,
    addToCartEvents: addToCart.length,
    purchases: orders.filter((order) => toDate(order.createdAt).getTime() >= toDate(sinceDate).getTime()).length,
    pageSessions: pageSessions.size,
    productSessions: productSessions.size,
    addToCartSessions: cartSessions.size,
    purchaseSessions: purchaseSessions.size,
    viewToCartPercent,
    cartToPurchasePercent,
    viewToPurchasePercent,
  };
}

function buildInventoryInsights(products, orders, now = new Date()) {
  const productMap = getProductMap(products);
  const lowStock = (products || []).filter((product) => product && product.isActive !== false && Number(product.stockQty || 0) <= 5);
  const soldLast30Days = new Map();
  const windowStart = addDays(now, -30);

  (orders || [])
    .filter((order) => toDate(order.createdAt).getTime() >= toDate(windowStart).getTime())
    .forEach((order) => {
      getOrderItems(order).forEach((item) => {
        const key = String(item.productId || "");
        soldLast30Days.set(key, (soldLast30Days.get(key) || 0) + Number(item.qty || 0));
      });
    });

  const slowMoving = (products || [])
    .filter((product) => product && product.isActive !== false && Number(product.stockQty || 0) > 0)
    .map((product) => {
      const productId = String(product.id || "");
      const unitsSold30d = Number(soldLast30Days.get(productId) || 0);
      const onHand = Math.max(0, Number(product.stockQty || 0));
      const turnoverRatio = onHand > 0 ? Math.round((unitsSold30d / onHand) * 100) / 100 : unitsSold30d;
      return {
        productId,
        name: product.name || productMap.get(productId)?.name || "Untitled product",
        stockQty: onHand,
        unitsSold30d,
        turnoverRatio,
      };
    })
    .filter((entry) => entry.unitsSold30d === 0 || entry.turnoverRatio < 0.25)
    .sort((left, right) => {
      if (left.unitsSold30d !== right.unitsSold30d) return left.unitsSold30d - right.unitsSold30d;
      return right.stockQty - left.stockQty;
    })
    .slice(0, 8);

  return {
    activeProducts: (products || []).filter((product) => product && product.isActive !== false).length,
    lowStockCount: lowStock.length,
    slowMoving,
  };
}

async function getAnalyticsOverview(options = {}) {
  const now = toDate(options.now || new Date());
  const [
    orderResult,
    productResult,
    trackingResult,
  ] = await Promise.all([
    storage.order.listAdmin({ limit: 5000 }),
    storage.product.listAdmin(),
    storage.tracking.list({ limit: 10000 }),
  ]);

  const orders = getOrderRows(orderResult?.orders || []);
  const products = Array.isArray(productResult?.products) ? productResult.products : [];
  const trackingEvents = Array.isArray(trackingResult?.events) ? trackingResult.events : [];

  const todayStart = startOfDay(now);
  const yesterdayStart = addDays(todayStart, -1);
  const weekStart = addDays(todayStart, -6);
  const previousWeekStart = addDays(weekStart, -7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const todayOrders = orders.filter((order) => withinRange(order.createdAt, todayStart, endOfDay(todayStart)));
  const yesterdayOrders = orders.filter((order) => withinRange(order.createdAt, yesterdayStart, endOfDay(yesterdayStart)));
  const weeklyOrders = orders.filter((order) => withinRange(order.createdAt, weekStart, endOfDay(now)));
  const previousWeeklyOrders = orders.filter((order) => withinRange(order.createdAt, previousWeekStart, endOfDay(addDays(weekStart, -1))));
  const monthlyOrders = orders.filter((order) => toDate(order.createdAt).getTime() >= monthStart.getTime());

  const todayRevenue = roundMoney(todayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0));
  const yesterdayRevenue = roundMoney(yesterdayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0));
  const weekRevenue = roundMoney(weeklyOrders.reduce((sum, order) => sum + Number(order.total || 0), 0));
  const previousWeekRevenue = roundMoney(previousWeeklyOrders.reduce((sum, order) => sum + Number(order.total || 0), 0));
  const monthRevenue = roundMoney(monthlyOrders.reduce((sum, order) => sum + Number(order.total || 0), 0));
  const averageOrderValue = orders.length
    ? roundMoney(orders.reduce((sum, order) => sum + Number(order.total || 0), 0) / orders.length)
    : 0;

  const productMap = getProductMap(products);
  const revenueSeries = buildRevenueSeries(weeklyOrders, weekStart, 7);
  const topProducts = buildTopProducts(orders, productMap, addDays(now, -30));
  const funnel = buildFunnel(trackingEvents, weeklyOrders, weekStart);
  const inventory = buildInventoryInsights(products, orders, now);

  return {
    generatedAt: now.toISOString(),
    sales: {
      todayRevenue,
      todayOrders: todayOrders.length,
      yesterdayRevenue,
      yesterdayOrders: yesterdayOrders.length,
      dailyRevenueChangePercent: toPercent(todayRevenue, yesterdayRevenue),
      weekRevenue,
      weekOrders: weeklyOrders.length,
      previousWeekRevenue,
      previousWeekOrders: previousWeeklyOrders.length,
      weeklyRevenueChangePercent: toPercent(weekRevenue, previousWeekRevenue),
      monthRevenue,
      averageOrderValue,
    },
    revenue: {
      chart: revenueSeries,
      topProducts,
    },
    funnel,
    inventory,
  };
}

module.exports = {
  getAnalyticsOverview,
};
