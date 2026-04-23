function notFound(_req, res) {
  res.status(404).json({ error: "Not found" });
}

function errorHandler(err, req, res, _next) {
  // Keep error messages user-friendly.
  const status = Number.isInteger(err?.status) ? err.status : 500;
  if (status >= 500) {
    console.error(
      `Request failed: ${req?.method || "UNKNOWN"} ${req?.originalUrl || req?.url || ""}`,
      err?.stack || err?.message || err
    );
  }
  const message = err?.publicMessage || (status === 500 ? "Internal server error" : (err?.message || "Request failed"));
  res.status(status).json({ error: message });
}

module.exports = { notFound, errorHandler };
