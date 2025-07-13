const mongoose = require("mongoose");
const campaignSchema = new mongoose.Schema(
  {
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true },
    niche: String,
    city: String,
    description: String,
    startDate: Date,
    endDate: Date,
    rewardType: { type: String, enum: ["barter", "money"], required: true },
    budgetRange: {
      min: Number,
      max: Number,
    },
    images: [String],
    status: {
      type: String,
      enum: ["draft", "active", "expired", "cancelled"],
      default: "active",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Campaign", campaignSchema);
