const mongoose = require("mongoose");

const cmsConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CmsConfig", cmsConfigSchema);

