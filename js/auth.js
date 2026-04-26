const AUTH_TOKEN_KEY = "blustup_token";
const AUTH_USER_KEY = "blustup_user";

function readStoredValue(key) {
  return localStorage.getItem(key) || sessionStorage.getItem(key);
}

function getActiveAuthStorage() {
  return localStorage.getItem(AUTH_TOKEN_KEY) ? localStorage : sessionStorage;
}

function getToken() {
  return readStoredValue(AUTH_TOKEN_KEY);
}

function getStoredUser() {
  const raw = readStoredValue(AUTH_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setAuth(token, user, options = {}) {
  const remember = options.remember !== false;
  clearAuth();
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(AUTH_TOKEN_KEY, token);
  if (user) storage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  updateLoginUI(user?.name, user);
}

function clearAuth() {
  [localStorage, sessionStorage].forEach((storage) => {
    storage.removeItem(AUTH_TOKEN_KEY);
    storage.removeItem(AUTH_USER_KEY);
  });
}

function persistStoredUser(user) {
  const storage = getActiveAuthStorage();
  if (!user) {
    storage.removeItem(AUTH_USER_KEY);
    updateLoginUI(null);
    return;
  }
  storage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  updateLoginUI(user?.name, user);
}

async function api(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const isFormData = options.body instanceof FormData;
  const headers = { ...(options.headers || {}) };
  if (!isFormData && options.body != null && method !== "GET" && method !== "HEAD" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await apiFetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function setLoginFeedback(message = "", type = "error") {
  const alert = document.getElementById("loginAlert");
  if (!alert) return;

  if (!message) {
    alert.hidden = true;
    alert.textContent = "";
    alert.className = "auth-alert";
    return;
  }

  alert.hidden = false;
  alert.textContent = message;
  alert.className = `auth-alert is-${type}`;
}

function setSignupFeedback(message = "", type = "error") {
  const alert = document.getElementById("signupAlert");
  if (!alert) return;

  if (!message) {
    alert.hidden = true;
    alert.textContent = "";
    alert.className = "auth-alert";
    return;
  }

  alert.hidden = false;
  alert.textContent = message;
  alert.className = `auth-alert is-${type}`;
}

function setLoginSubmitting(submitting) {
  const button = document.getElementById("loginSubmitBtn");
  const label = button?.querySelector(".login-btn-label");
  if (button) {
    button.disabled = submitting;
    button.setAttribute("aria-busy", String(submitting));
  }
  if (label) {
    label.textContent = submitting ? "Signing in..." : "Sign In";
  }
}

function setSignupSubmitting(submitting) {
  const button = document.getElementById("signupSubmitBtn");
  const label = button?.querySelector(".signup-btn-label");
  if (button) {
    button.disabled = submitting;
    button.setAttribute("aria-busy", String(submitting));
  }
  if (label) {
    label.textContent = submitting ? "Creating account..." : "Create Account";
  }
}

function wirePasswordToggle(buttonId, inputId, hiddenLabel, shownLabel) {
  const button = document.getElementById(buttonId);
  const input = document.getElementById(inputId);
  if (!button || !input) return;

  button.addEventListener("click", () => {
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    button.textContent = showing ? "Show" : "Hide";
    button.setAttribute("aria-label", showing ? hiddenLabel : shownLabel);
    button.setAttribute("aria-pressed", String(!showing));
  });
}

function wireLoginExperience() {
  const password = document.getElementById("loginPassword");
  const forgot = document.getElementById("forgotPasswordBtn");
  const support = document.getElementById("loginSupportBtn");
  const email = document.getElementById("loginEmail");

  wirePasswordToggle("toggleLoginPassword", "loginPassword", "Show password", "Hide password");

  if (forgot) {
    forgot.addEventListener("click", () => {
      setLoginFeedback(
        "Password reset is not available in this local build yet. Please contact support if you need help signing in.",
        "info"
      );
    });
  }

  if (support) {
    support.addEventListener("click", () => {
      setLoginFeedback(
        "Account help is available from the FAQ page while password reset is being set up.",
        "info"
      );
    });
  }

  [email, password].forEach((field) => {
    field?.addEventListener("input", () => setLoginFeedback(""));
  });
}

function wireSignupExperience() {
  const signupFields = [
    document.getElementById("signupName"),
    document.getElementById("signupEmail"),
    document.getElementById("signupPhone"),
    document.getElementById("signupPassword"),
    document.getElementById("signupConfirmPassword"),
    document.getElementById("signupTerms"),
  ];
  const help = document.getElementById("signupHelpBtn");

  wirePasswordToggle("toggleSignupPassword", "signupPassword", "Show password", "Hide password");
  wirePasswordToggle(
    "toggleSignupConfirmPassword",
    "signupConfirmPassword",
    "Show confirm password",
    "Hide confirm password"
  );

  signupFields.forEach((field) => {
    field?.addEventListener("input", () => setSignupFeedback(""));
    field?.addEventListener("change", () => setSignupFeedback(""));
  });

  if (help) {
    help.addEventListener("click", () => {
      setSignupFeedback(
        "If you already have an account, sign in instead. Otherwise use your personal details and a password with at least 8 characters.",
        "info"
      );
    });
  }
}

/* SIGNUP */
const signupForm = document.getElementById("signupForm");
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nameInput = document.getElementById("signupName");
    const emailInput = document.getElementById("signupEmail");
    const phoneInput = document.getElementById("signupPhone");
    const passwordInput = document.getElementById("signupPassword");
    const confirmInput = document.getElementById("signupConfirmPassword");
    const termsInput = document.getElementById("signupTerms");

    const name = nameInput?.value.trim() || "";
    const email = emailInput?.value.trim() || "";
    const phone = phoneInput?.value.trim() || "";
    const password = passwordInput?.value || "";
    const confirmPassword = confirmInput?.value || "";
    const digitCount = phone.replace(/\D/g, "").length;

    if (name.length < 2) {
      setSignupFeedback("Enter your full name.", "error");
      nameInput?.focus();
      return;
    }

    if (!emailInput?.checkValidity()) {
      setSignupFeedback("Enter a valid email address.", "error");
      emailInput?.focus();
      return;
    }

    if (digitCount < 8) {
      setSignupFeedback("Enter a valid phone number with at least 8 digits.", "error");
      phoneInput?.focus();
      return;
    }

    if (password.length < 8) {
      setSignupFeedback("Create a password with at least 8 characters.", "error");
      passwordInput?.focus();
      return;
    }

    if (password !== confirmPassword) {
      setSignupFeedback("Your password confirmation does not match.", "error");
      confirmInput?.focus();
      return;
    }

    if (!termsInput?.checked) {
      setSignupFeedback("You need to accept the terms before creating an account.", "error");
      termsInput?.focus();
      return;
    }

    setSignupSubmitting(true);
    setSignupFeedback("");

    try {
      const { token, user } = await api("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ name, email, phone, password }),
      });
      setAuth(token, user, { remember: true });
      setSignupFeedback("Account created successfully. Redirecting you now...", "success");
      showToast("OK", "Account created!");
      showPage("home");
    } catch (err) {
      setSignupFeedback(err.message || "Signup failed", "error");
    } finally {
      setSignupSubmitting(false);
    }
  });
}

/* LOGIN */
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const emailInput = document.getElementById("loginEmail");
    const passwordInput = document.getElementById("loginPassword");
    const rememberMe = document.getElementById("rememberMe");

    if (!emailInput?.value.trim()) {
      setLoginFeedback("Enter your email address.", "error");
      emailInput?.focus();
      return;
    }

    if (!emailInput.checkValidity()) {
      setLoginFeedback("Enter a valid email address.", "error");
      emailInput.focus();
      return;
    }

    if (!passwordInput?.value) {
      setLoginFeedback("Enter your password.", "error");
      passwordInput?.focus();
      return;
    }

    setLoginSubmitting(true);
    setLoginFeedback("");

    try {
      const { token, user } = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: emailInput.value.trim(),
          password: passwordInput.value,
        }),
      });

      setAuth(token, user, { remember: rememberMe?.checked !== false });
      showToast("OK", "Logged in!");
      showPage("home");
    } catch (err) {
      setLoginFeedback(err.message || "Login failed", "error");
    } finally {
      setLoginSubmitting(false);
    }
  });
}

function setButtonState(button, label, handler) {
  if (!button) return;
  button.textContent = label;
  button.onclick = handler;
}

/* UPDATE NAV UI */
function updateLoginUI(name, user) {
  const desktopButton = document.getElementById("loginBtn");
  const mobileButton = document.getElementById("loginBtnMobile");
  if (typeof loadCartFromStorage === "function") loadCartFromStorage();

  if (!name) {
    setButtonState(desktopButton, "Log In", () => showPage("login"));
    setButtonState(mobileButton, "Log In", () => {
      showPage("login");
      if (typeof closeMenu === "function") closeMenu();
    });
  } else {
    const shortName = String(name).trim().split(/\s+/)[0]?.slice(0, 18) || "Account";
    setButtonState(desktopButton, shortName, () => showPage("orders"));
    setButtonState(mobileButton, "My Orders", () => {
      if (typeof closeMenu === "function") closeMenu();
      showPage("orders");
    });
  }

  const existing = document.getElementById("adminLink");
  if (user?.role === "admin") {
    if (!existing) {
      const a = document.createElement("a");
      a.id = "adminLink";
      a.textContent = "Admin";
      a.style.cursor = "pointer";
      a.onclick = () => {
        window.location.href = typeof buildSiteUrl === "function" ? buildSiteUrl("/admin.html") : "/admin.html";
      };
      const navLinks = document.querySelector(".nav-links");
      if (navLinks) {
        const li = document.createElement("li");
        li.appendChild(a);
        navLinks.appendChild(li);
      }
    }
  } else if (existing) {
    existing.closest("li")?.remove();
  }

  if (typeof refreshLoyaltyExperience === "function") {
    refreshLoyaltyExperience(user || null);
  }
  if (typeof renderCart === "function") renderCart();
  if (typeof renderCheckout === "function") renderCheckout();
}

/* LOGOUT */
function logout() {
  clearAuth();
  updateLoginUI(null);
  location.reload();
}

window.getToken = getToken;
window.getStoredUser = getStoredUser;
window.persistStoredUser = persistStoredUser;
window.logout = logout;

/* ─── FORGOT PASSWORD ─── */
async function forgotPassword(event) {
  if (event) event.preventDefault();
  const email = document.getElementById("forgot-email")?.value?.trim();
  const feedback = document.getElementById("forgot-feedback");
  const btn = document.getElementById("forgot-submit-btn");

  if (!email) {
    if (feedback) { feedback.textContent = "Please enter your email address."; feedback.className = "auth-feedback error"; }
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = "Sending..."; }

  try {
    const res = await api("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
    if (feedback) { feedback.textContent = res.message || "Check your email for a reset link."; feedback.className = "auth-feedback success"; }
  } catch (err) {
    if (feedback) { feedback.textContent = err.message || "Something went wrong."; feedback.className = "auth-feedback error"; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Send Reset Link"; }
  }
}

async function resetPassword(event) {
  if (event) event.preventDefault();
  const password = document.getElementById("reset-password")?.value;
  const confirm = document.getElementById("reset-password-confirm")?.value;
  const feedback = document.getElementById("reset-feedback");
  const btn = document.getElementById("reset-submit-btn");

  const hash = window.location.hash || "";
  const tokenMatch = hash.match(/[?&]token=([^&]+)/);
  const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : "";

  if (!token) {
    if (feedback) { feedback.textContent = "Invalid reset link. Please request a new one."; feedback.className = "auth-feedback error"; }
    return;
  }
  if (!password || password.length < 8) {
    if (feedback) { feedback.textContent = "Password must be at least 8 characters."; feedback.className = "auth-feedback error"; }
    return;
  }
  if (password !== confirm) {
    if (feedback) { feedback.textContent = "Passwords do not match."; feedback.className = "auth-feedback error"; }
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = "Resetting..."; }

  try {
    const res = await api("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) });
    if (feedback) { feedback.textContent = res.message || "Password reset! You can now sign in."; feedback.className = "auth-feedback success"; }
    setTimeout(() => showPage("login"), 3000);
  } catch (err) {
    if (feedback) { feedback.textContent = err.message || "Failed to reset password."; feedback.className = "auth-feedback error"; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Reset Password"; }
  }
}

window.forgotPassword = forgotPassword;
window.resetPassword = resetPassword;

/* ─── HASH-BASED ROUTING FOR TOKENS ─── */
function handleAuthHash() {
  const hash = window.location.hash || "";

  if (hash.startsWith("#verify-email")) {
    const tokenMatch = hash.match(/[?&]token=([^&]+)/);
    if (tokenMatch) {
      const token = decodeURIComponent(tokenMatch[1]);
      api(`/api/auth/verify-email?token=${encodeURIComponent(token)}`).then((res) => {
        if (typeof showToast === "function") showToast("OK", res.message || "Email verified!");
      }).catch((err) => {
        if (typeof showToast === "function") showToast("!", err.message || "Verification failed.");
      });
      window.location.hash = "";
    }
  }

  if (hash.startsWith("#reset-password")) {
    if (typeof showPage === "function") showPage("reset-password");
  }
}

/* AUTO LOGIN */
document.addEventListener("DOMContentLoaded", async () => {
  wireLoginExperience();
  wireSignupExperience();

  const token = getToken();
  if (!token) {
    updateLoginUI(null);
    handleAuthHash();
    return;
  }

  try {
    const { user } = await api("/api/auth/me");
    persistStoredUser(user);
  } catch {
    clearAuth();
    updateLoginUI(null);
  }

  handleAuthHash();
});
