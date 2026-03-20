const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    action: { type: String, required: true, maxlength: 50 }, // add/change/delete
    entityType: { type: String, required: true, maxlength: 50 }, // product, group, ...
    entityId: { type: String, default: null },
    summary: { type: String, required: true, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);

