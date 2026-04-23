const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    price: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 1 },
    imageUrl: { type: String, default: null },
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    firstName: { type: String, trim: true, maxlength: 80, default: null },
    lastName: { type: String, trim: true, maxlength: 80, default: null },
    street: { type: String, trim: true, maxlength: 160, default: null },
    city: { type: String, trim: true, maxlength: 80, default: null },
    state: { type: String, trim: true, maxlength: 80, default: null },
    zip: { type: String, trim: true, maxlength: 20, default: null },
    country: { type: String, trim: true, maxlength: 80, default: null },
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
      enum: ["placed", "processing", "shipped", "delivered", "cancelled"],
    },
    note: { type: String, trim: true, maxlength: 240, default: "" },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actorEmail: { type: String, trim: true, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const deliveryAssignmentSchema = new mongoose.Schema(
  {
    id: { type: String, trim: true, default: null },
    riderId: { type: String, trim: true, default: null },
    riderName: { type: String, trim: true, maxlength: 120, default: null },
    riderEmail: { type: String, trim: true, lowercase: true, maxlength: 200, default: null },
    riderPhone: { type: String, trim: true, maxlength: 30, default: null },
    coverage: { type: String, trim: true, maxlength: 120, default: null },
    status: { type: String, trim: true, maxlength: 60, default: null },
    note: { type: String, trim: true, maxlength: 500, default: "" },
    source: { type: String, trim: true, maxlength: 60, default: null },
    assignedAt: { type: Date, default: null },
    notifiedAt: { type: Date, default: null },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    sessionId: { type: String, default: null },
    customerName: { type: String, required: true, trim: true, maxlength: 160 },
    customerEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 200, index: true },
    customerPhone: { type: String, trim: true, maxlength: 20, default: null },
    billingAddress: { type: addressSchema, default: () => ({}) },
    items: { type: [orderItemSchema], default: [] },
    paymentMethod: { type: String, required: true, trim: true, maxlength: 20 },
    promoCode: { type: String, trim: true, maxlength: 40, default: null },
    promoLabel: { type: String, trim: true, maxlength: 120, default: null },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: true, min: 0, default: 0 },
    shipping: { type: Number, required: true, min: 0, default: 0 },
    tax: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    loyaltyEarned: { type: Number, required: true, min: 0, default: 0 },
    loyaltyBalanceAfter: { type: Number, required: true, min: 0, default: 0 },
    loyaltyTierAfter: { type: String, trim: true, maxlength: 40, default: null },
    status: {
      type: String,
      required: true,
      enum: ["placed", "processing", "shipped", "delivered", "cancelled"],
      default: "placed",
      index: true,
    },
    deliveryAssignment: { type: deliveryAssignmentSchema, default: null },
    statusHistory: { type: [statusHistorySchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
