const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema({
  campaign: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Campaign",
    required: true,
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected", "withdrawn"],
    default: "pending",
  },
  message: {
    type: String,
    trim: true,
    maxlength: 1000,
  },
  proposedDeliverables: {
    type: String,
    trim: true,
    maxlength: 2000,
  },
  proposedTimeline: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  brandResponse: {
    message: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    respondedAt: Date,
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  appliedAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

// Compound index to prevent duplicate applications
applicationSchema.index({ campaign: 1, creator: 1 }, { unique: true });

// Index for querying applications by campaign
applicationSchema.index({ campaign: 1, status: 1 });

// Index for querying applications by creator
applicationSchema.index({ creator: 1, status: 1 });

// Index for querying by application date
applicationSchema.index({ appliedAt: -1 });

module.exports = mongoose.model("Application", applicationSchema);