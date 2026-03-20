function getToken() {
  return localStorage.getItem("blustup_token");
}

function setAuth(token, user) {
  localStorage.setItem("blustup_token", token);
  localStorage.setItem("blustup_user", JSON.stringify(user));
  updateLoginUI(user?.name, user);
}

function clearAuth() {
  localStorage.removeItem("blustup_token");
  localStorage.removeItem("blustup_user");
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

/* SIGNUP */
const signupForm = document.getElementById("signupForm");
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("signupName").value;
    const email = document.getElementById("signupEmail").value;
    const password = document.getElementById("signupPassword").value;
    try {
      const { token, user } = await api("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      setAuth(token, user);
      showToast("✓", "Account created!");
      showPage("home");
    } catch (err) {
      alert(err.message || "Signup failed");
    }
  });
}

/* LOGIN */
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;
    try {
      const { token, user } = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setAuth(token, user);
      showToast("✓", "Logged in!");
      showPage("home");
    } catch (err) {
      alert(err.message || "Login failed");
    }
  });
}

/* UPDATE NAV UI */
function updateLoginUI(name, user) {
  const btn = document.getElementById("loginBtn");
  if (!btn) return;
  if (!name) {
    btn.textContent = "Log In";
    btn.onclick = () => showPage("login");
    return;
  }
  btn.textContent = name;
  btn.onclick = logout;

  // Admin quick-link (only visible for admins)
  const existing = document.getElementById("adminLink");
  if (user?.role === "admin") {
    if (!existing) {
      const a = document.createElement("a");
      a.id = "adminLink";
      a.textContent = "Admin";
      a.style.cursor = "pointer";
      a.onclick = () => (window.location.href = "/admin.html");
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
}

/* LOGOUT */
function logout() {
  clearAuth();
  updateLoginUI(null);
  location.reload();
}

/* AUTO LOGIN */
document.addEventListener("DOMContentLoaded", async () => {
  const cached = localStorage.getItem("blustup_user");
  const token = getToken();
  if (!token) return updateLoginUI(null);

  try {
    const { user } = await api("/api/auth/me");
    localStorage.setItem("blustup_user", JSON.stringify(user));
    updateLoginUI(user.name, user);
  } catch {
    // token invalid/expired
    clearAuth();
    if (cached) updateLoginUI(null);
  }
});