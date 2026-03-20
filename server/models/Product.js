const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    price: { type: Number, required: true, min: 0 },
    description: { type: String, required: true, trim: true, default: "" },

    // Keep the naming close to your frontend terminology.
    category: { type: String, required: true, trim: true, default: "general", maxlength: 80 },
    stockQty: { type: Number, required: true, min: 0, default: 0 },

    imageUrl: { type: String, default: null },

    // Optional fields used by your existing UI.
    oldPrice: { type: Number, default: null, min: 0 },
    badge: { type: String, default: null, maxlength: 80 },
    badgeType: { type: String, default: null, maxlength: 80 },
    icon: { type: String, default: null, maxlength: 10 },
    color: { type: String, default: null, maxlength: 200 },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);

