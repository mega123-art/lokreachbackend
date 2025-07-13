const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    messageType: {
      type: String,
      enum: ["text", "offer", "system"],
      default: "text",
    },
    // For offer messages
    offerDetails: {
      amount: Number,
      currency: {
        type: String,
        default: "USD",
      },
      description: String,
      deadline: Date,
    },
    // Message status
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
    readBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // For system messages (like "Brand started this conversation")
    systemMessageType: {
      type: String,
      enum: ["chat_started", "offer_sent", "offer_accepted", "offer_declined"],
    },
  },
  {
    timestamps: true,
  }
);

// Index for querying messages in a chat
messageSchema.index({ chat: 1, createdAt: -1 });

// Index for unread messages
messageSchema.index({ chat: 1, status: 1 });

// Index for sender queries
messageSchema.index({ sender: 1, createdAt: -1 });

module.exports = mongoose.model("Message", messageSchema);