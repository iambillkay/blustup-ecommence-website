(function bootstrapBlustupApiHelpers() {
  const DEFAULT_API_PORT = "3000";

  function trimTrailingSlash(value) {
    return String(value || "").trim().replace(/\/+$/, "");
  }

  function isLocalHost(hostname) {
    const value = String(hostname || "").trim().toLowerCase();
    return value === "localhost" || value === "127.0.0.1" || value === "0.0.0.0";
  }

  function shouldUseStoredApiBase() {
    if (window.location.protocol === "file:") return true;
    return isLocalHost(window.location.hostname);
  }

  function readStoredApiBase() {
    const explicitBase = trimTrailingSlash(window.BLUSTUP_API_BASE);
    if (explicitBase) return explicitBase;
    if (!shouldUseStoredApiBase()) return "";

    try {
      return (
        trimTrailingSlash(localStorage.getItem("blustup_api_base"))
        || trimTrailingSlash(sessionStorage.getItem("blustup_api_base"))
      );
    } catch (_e) {
      return "";
    }
  }

  function getLocalBackendOrigin() {
    return `http://127.0.0.1:${DEFAULT_API_PORT}`;
  }

  function getHostedAppPath(fallbackPath) {
    const normalizedFallback = normalizePath(fallbackPath || "/");
    const currentPath = String(window.location.pathname || "").trim();
    const lowerPath = currentPath.toLowerCase();

    if (window.location.protocol === "file:") {
      if (lowerPath.endsWith("/admin.html") || lowerPath.endsWith("\\admin.html") || lowerPath.endsWith("admin.html")) {
        return "/admin.html";
      }
      return normalizedFallback;
    }

    return normalizePath(currentPath || normalizedFallback);
  }

  function getApiBase() {
    const configured = readStoredApiBase();
    if (configured) return configured;

    if (window.location.protocol === "file:") {
      return getLocalBackendOrigin();
    }

    if (String(window.location.port || "") === DEFAULT_API_PORT) return "";

    if (isLocalHost(window.location.hostname)) {
      return getLocalBackendOrigin();
    }

    return "";
  }

  function normalizePath(path) {
    const value = String(path || "").trim();
    return value.startsWith("/") ? value : `/${value}`;
  }

  function buildApiUrl(path) {
    const base = getApiBase();
    const normalizedPath = normalizePath(path);
    return base ? `${base}${normalizedPath}` : normalizedPath;
  }

  function getSiteBaseUrl() {
    const apiBase = getApiBase();
    if (apiBase) return apiBase;

    if (window.location.protocol === "file:") {
      return `http://127.0.0.1:${DEFAULT_API_PORT}`;
    }

    return trimTrailingSlash(window.location.origin || "");
  }

  function buildSiteUrl(path = "/") {
    const base = trimTrailingSlash(getSiteBaseUrl());
    const normalizedPath = normalizePath(path);
    return base ? `${base}${normalizedPath}` : normalizedPath;
  }

  function shouldRedirectToHostedLocalApp() {
    if (window.location.protocol === "file:") return true;
    if (!isLocalHost(window.location.hostname)) return false;
    if (String(window.location.port || "") === DEFAULT_API_PORT) return false;
    return true;
  }

  function redirectToHostedLocalApp(fallbackPath = "/") {
    if (!shouldRedirectToHostedLocalApp()) return false;

    const targetBase = getLocalBackendOrigin();
    const targetPath = getHostedAppPath(fallbackPath);
    const targetUrl = `${targetBase}${targetPath}${window.location.search || ""}${window.location.hash || ""}`;

    if (window.location.href !== targetUrl) {
      window.location.replace(targetUrl);
      return true;
    }

    return false;
  }

  function apiFetch(path, options) {
    return fetch(buildApiUrl(path), options);
  }

  window.getApiBase = getApiBase;
  window.buildApiUrl = buildApiUrl;
  window.apiFetch = apiFetch;
  window.getSiteBaseUrl = getSiteBaseUrl;
  window.buildSiteUrl = buildSiteUrl;
  window.redirectToHostedLocalApp = redirectToHostedLocalApp;
})();
