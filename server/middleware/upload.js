const path = require("path");
const fs = require("fs");
const multer = require("multer");

const rootDir = path.join(__dirname, "..", "..");
const uploadsDir = path.join(rootDir, "public", "uploads");

function ensureUploadsDir() {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function fileFilter(_req, file, cb) {
  const allowed = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/svg+xml",
  ]);
  if (!allowed.has(file.mimetype)) {
    return cb(new Error("Only image uploads are allowed"));
  }
  return cb(null, true);
}

const upload = multer({
  storage: multer.diskStorage({
    destination: function destination(_req, _file, cb) {
      ensureUploadsDir();
      cb(null, uploadsDir);
    },
    filename: function filename(_req, file, cb) {
      // Simple, collision-resistant filename.
      const ext = path.extname(file.originalname).toLowerCase() || "";
      const base = path.basename(file.originalname, ext).replace(/[^\w-]+/g, "-");
      const safeBase = base.slice(0, 60) || "image";
      const stamp = Date.now().toString(36);
      cb(null, `${safeBase}-${stamp}${ext}`);
    },
  }),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

module.exports = { upload, uploadsDir };

