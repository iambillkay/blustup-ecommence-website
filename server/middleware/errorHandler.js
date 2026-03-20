function notFound(_req, res) {
  res.status(404).json({ error: "Not found" });
}

function errorHandler(err, _req, res, _next) {
  // Keep error messages user-friendly.
  const status = Number.isInteger(err?.status) ? err.status : 500;
  const message = status === 500 ? "Internal server error" : (err?.message || "Request failed");
  res.status(status).json({ error: message });
}

module.exports = { notFound, errorHandler };

