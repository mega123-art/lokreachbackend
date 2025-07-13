const mongoose = require("mongoose");

const savedProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    savedProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    savedAt: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate saves
savedProfileSchema.index({ user: 1, savedProfile: 1 }, { unique: true });

// Index for querying user's saved profiles
savedProfileSchema.index({ user: 1, savedAt: -1 });

// Index for analytics - who saved this profile
savedProfileSchema.index({ savedProfile: 1, savedAt: -1 });

module.exports = mongoose.model("SavedProfile", savedProfileSchema);
