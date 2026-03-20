const { verifyJwt } = require("../config/jwt");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = String(header).startsWith("Bearer ") ? String(header).slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    const decoded = verifyJwt(token);
    // `sub` is the standard JWT "subject".
    req.user = {
      sub: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
    };
    return next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireRole(...roles) {
  const allowed = new Set(roles);
  return function roleMiddleware(req, res, next) {
    if (!req.user?.role || !allowed.has(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };

