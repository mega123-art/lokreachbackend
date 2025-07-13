const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
    },
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["active", "archived", "blocked"],
      default: "active",
    },
    // For tracking recruitment status
    recruitmentStatus: {
      type: String,
      enum: ["discussing", "offer_sent", "accepted", "declined", "completed"],
      default: "discussing",
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure unique chat per campaign-participant combination
chatSchema.index({ campaign: 1, participants: 1 }, { unique: true });

// Index for querying user's chats
chatSchema.index({ participants: 1, lastActivity: -1 });

// Index for campaign-related chats
chatSchema.index({ campaign: 1, status: 1 });

module.exports = mongoose.model("Chat", chatSchema);