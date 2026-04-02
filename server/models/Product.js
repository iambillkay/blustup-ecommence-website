const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    price: { type: Number, required: true, min: 0 },
    description: { type: String, required: true, trim: true, default: "" },

    // Keep the naming close to your frontend terminology.
    category: { type: String, required: true, trim: true, default: "general", maxlength: 80 },
    categories: {
      type: [String],
      default: ["general"],
      validate: {
        validator(values) {
          return Array.isArray(values) && values.length > 0 && values.every((value) => typeof value === "string" && value.trim());
        },
        message: "At least one category is required",
      },
    },
    stockQty: { type: Number, required: true, min: 0, default: 0 },

    imageUrl: { type: String, default: null },

    // Optional fields used by your existing UI.
    oldPrice: { type: Number, default: null, min: 0 },
    badge: { type: String, default: null, maxlength: 80 },
    badgeType: { type: String, default: null, maxlength: 80 },
    icon: { type: String, default: null, maxlength: 10 },
    color: { type: String, default: null, maxlength: 200 },
    ratingAverage: { type: Number, default: null, min: 1, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    reviews: {
      type: [
        {
          author: { type: String, trim: true, maxlength: 80, default: "" },
          rating: { type: Number, min: 1, max: 5, default: 5 },
          title: { type: String, trim: true, maxlength: 120, default: "" },
          comment: { type: String, trim: true, maxlength: 600, default: "" },
          verifiedPurchase: { type: Boolean, default: true },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

productSchema.pre("validate", function syncPrimaryCategory(next) {
  const categories = Array.isArray(this.categories)
    ? [...new Set(this.categories.map((value) => String(value || "").trim()).filter(Boolean))]
    : [];

  if (categories.length) {
    this.categories = categories;
    this.category = categories[0];
  } else {
    const fallback = String(this.category || "general").trim() || "general";
    this.category = fallback;
    this.categories = [fallback];
  }

  next();
});

module.exports = mongoose.model("Product", productSchema);
