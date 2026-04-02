const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, maxlength: 200 },
    passwordHash: { type: String, required: true },
    phone: { type: String, trim: true, maxlength: 20, default: null },
    loyaltyPoints: { type: Number, min: 0, default: 0 },
    billingProfile: {
      firstName: { type: String, trim: true, maxlength: 80, default: null },
      lastName: { type: String, trim: true, maxlength: 80, default: null },
      street: { type: String, trim: true, maxlength: 160, default: null },
      city: { type: String, trim: true, maxlength: 80, default: null },
      state: { type: String, trim: true, maxlength: 80, default: null },
      zip: { type: String, trim: true, maxlength: 20, default: null },
      country: { type: String, trim: true, maxlength: 80, default: null },
    },
    role: { type: String, required: true, enum: ["user", "admin"], default: "user" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
