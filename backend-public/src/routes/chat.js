const express = require("express");
const router = express.Router();
const Chat = require("../models/Chat");
const Message = require("../models/Message");
const Campaign = require("../models/Campaign");
const User = require("../models/User");
const { authenticate, authorizeRoles } = require("../middleware/auth");

// POST /api/chats/initiate - Initiate chat (brand recruits creator)
router.post("/initiate", authenticate, authorizeRoles("brand"), async (req, res) => {
  try {
    const { campaignId, creatorId, initialMessage } = req.body;
    const brandId = req.user._id;

    if (!campaignId || !creatorId) {
      return res.status(400).json({ 
        error: "Campaign ID and Creator ID are required" 
      });
    }

    // Verify campaign belongs to the brand
    const campaign = await Campaign.findOne({ 
      _id: campaignId, 
      brand: brandId 
    });

    if (!campaign) {
      return res.status(404).json({ 
        error: "Campaign not found or access denied" 
      });
    }

    // Verify creator applied to this campaign
    const hasApplied = campaign.appliedCreators.some(
      app => app.creator.toString() === creatorId
    );

    if (!hasApplied) {
      return res.status(400).json({ 
        error: "Creator has not applied to this campaign" 
      });
    }

    // Verify creator exists and is approved
    const creator = await User.findOne({ 
      _id: creatorId, 
      role: "creator", 
      status: "approved" 
    });

    if (!creator) {
      return res.status(404).json({ error: "Creator not found" });
    }

    // Check if chat already exists
    let existingChat = await Chat.findOne({
      campaign: campaignId,
      participants: { $all: [brandId, creatorId] }
    });

    if (existingChat) {
      return res.status(400).json({ 
        error: "Chat already exists",
        chatId: existingChat._id 
      });
    }

    // Create new chat
    const newChat = new Chat({
      participants: [brandId, creatorId],
      campaign: campaignId,
      initiatedBy: brandId,
      lastActivity: new Date(),
    });

    await newChat.save();

    // Create initial system message
    const systemMessage = new Message({
      chat: newChat._id,
      sender: brandId,
      content: `${req.user.brandName} started a conversation about "${campaign.name}"`,
      messageType: "system",
      systemMessageType: "chat_started",
    });

    await systemMessage.save();

    // Create initial message if provided
    if (initialMessage && initialMessage.trim()) {
      const firstMessage = new Message({
        chat: newChat._id,
        sender: brandId,
        content: initialMessage.trim(),
        messageType: "text",
      });

      await firstMessage.save();
      newChat.lastMessage = firstMessage._id;
    } else {
      newChat.lastMessage = systemMessage._id;
    }

    newChat.lastActivity = new Date();
    await newChat.save();

    // Populate chat for response
    const populatedChat = await Chat.findById(newChat._id)
      .populate("participants", "brandName instaUsername email role")
      .populate("campaign", "name description")
      .populate("lastMessage");

    // Emit socket event for real-time notification
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${creatorId}`).emit('new_chat', {
        chat: populatedChat,
        message: "You have a new message from a brand!"
      });
    }

    res.status(201).json({
      message: "Chat initiated successfully",
      chat: populatedChat,
    });
  } catch (err) {
    console.error("Initiate chat error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/chats - Get user's chats (inbox)
router.get("/", authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20, status = "active" } = req.query;

    // Calculate pagination
    const pageNumber = Math.max(1, parseInt(page));
    const pageSize = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNumber - 1) * pageSize;

    // Build filter
    const filter = {
      participants: userId,
      status: status,
    };

    // Get chats with populated data
    const chats = await Chat.find(filter)
      .populate("participants", "brandName instaUsername email role")
      .populate("campaign", "name description status")
      .populate("lastMessage")
      .sort({ lastActivity: -1 })
      .skip(skip)
      .limit(pageSize);

    // Get unread message counts for each chat
    const chatsWithUnreadCount = await Promise.all(
      chats.map(async (chat) => {
        const unreadCount = await Message.countDocuments({
          chat: chat._id,
          sender: { $ne: userId },
          status: { $ne: "read" },
        });

        return {
          ...chat.toObject(),
          unreadCount,
        };
      })
    );

    const totalCount = await Chat.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / pageSize);

    res.status(200).json({
      chats: chatsWithUnreadCount,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalItems: totalCount,
        itemsPerPage: pageSize,
        hasNextPage: pageNumber < totalPages,
        hasPreviousPage: pageNumber > 1,
      },
    });
  } catch (err) {
    console.error("Get chats error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/chats/:chatId - Get specific chat details
router.get("/:chatId", authenticate, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    // Find chat and verify user is participant
    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId,
    })
      .populate("participants", "brandName instaUsername email role scrapedData")
      .populate("campaign", "name description status rewardType budgetRange");

    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    res.status(200).json({ chat });
  } catch (err) {
    console.error("Get chat error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/chats/:chatId/messages - Get messages in a chat
router.get("/:chatId/messages", authenticate, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;
    const { page = 1, limit = 50 } = req.query;

    // Verify user is participant in this chat
    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId,
    });

    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Calculate pagination
    const pageNumber = Math.max(1, parseInt(page));
    const pageSize = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNumber - 1) * pageSize;

    // Get messages
    const messages = await Message.find({ chat: chatId })
      .populate("sender", "brandName instaUsername role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);

    // Reverse to show oldest first
    messages.reverse();

    const totalCount = await Message.countDocuments({ chat: chatId });
    const totalPages = Math.ceil(totalCount / pageSize);

    res.status(200).json({
      messages,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalItems: totalCount,
        itemsPerPage: pageSize,
        hasNextPage: pageNumber < totalPages,
        hasPreviousPage: pageNumber > 1,
      },
    });
  } catch (err) {
    console.error("Get messages error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/chats/:chatId/messages - Send a message
router.post("/:chatId/messages", authenticate, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;
    const { content, messageType = "text", offerDetails } = req.body;

    if (!content || content.trim() === "") {
      return res.status(400).json({ error: "Message content is required" });
    }

    // Verify user is participant in this chat
    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId,
      status: "active",
    });

    if (!chat) {
      return res.status(404).json({ error: "Chat not found or inactive" });
    }

    // Create message
    const newMessage = new Message({
      chat: chatId,
      sender: userId,
      content: content.trim(),
      messageType,
      ...(messageType === "offer" && offerDetails && { offerDetails }),
    });

    await newMessage.save();

    // Update chat's last message and activity
    chat.lastMessage = newMessage._id;
    chat.lastActivity = new Date();
    await chat.save();

    // Populate message for response
    const populatedMessage = await Message.findById(newMessage._id)
      .populate("sender", "brandName instaUsername role");

    // Emit socket event to other participants
    const io = req.app.get('io');
    if (io) {
      const otherParticipants = chat.participants.filter(
        p => p.toString() !== userId.toString()
      );

      otherParticipants.forEach(participantId => {
        io.to(`user_${participantId}`).emit('new_message', {
          chatId,
          message: populatedMessage,
        });
      });
    }

    res.status(201).json({
      message: "Message sent successfully",
      messageData: populatedMessage,
    });
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/chats/:chatId/messages/:messageId/read - Mark message as read
router.patch("/:chatId/messages/:messageId/read", authenticate, async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const userId = req.user._id;

    // Verify user is participant in this chat
    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId,
    });

    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Update message read status
    const message = await Message.findOneAndUpdate(
      {
        _id: messageId,
        chat: chatId,
        sender: { $ne: userId }, // Can't mark own messages as read
      },
      {
        status: "read",
        $addToSet: {
          readBy: {
            user: userId,
            readAt: new Date(),
          },
        },
      },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    res.status(200).json({ message: "Message marked as read" });
  } catch (err) {
    console.error("Mark message read error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/chats/:chatId/read-all - Mark all messages in chat as read
router.patch("/:chatId/read-all", authenticate, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    // Verify user is participant in this chat
    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId,
    });

    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Mark all unread messages as read
    await Message.updateMany(
      {
        chat: chatId,
        sender: { $ne: userId },
        status: { $ne: "read" },
      },
      {
        status: "read",
        $addToSet: {
          readBy: {
            user: userId,
            readAt: new Date(),
          },
        },
      }
    );

    res.status(200).json({ message: "All messages marked as read" });
  } catch (err) {
    console.error("Mark all read error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/chats/:chatId/status - Update chat status
router.patch("/:chatId/status", authenticate, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;
    const { status, recruitmentStatus } = req.body;

    if (status && !["active", "archived", "blocked"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    if (recruitmentStatus && !["discussing", "offer_sent", "accepted", "declined", "completed"].includes(recruitmentStatus)) {
      return res.status(400).json({ error: "Invalid recruitment status" });
    }

    // Verify user is participant in this chat
    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId,
    });

    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Update chat status
    const updateData = {};
    if (status) updateData.status = status;
    if (recruitmentStatus) updateData.recruitmentStatus = recruitmentStatus;

    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      updateData,
      { new: true }
    ).populate("participants", "brandName instaUsername role");

    res.status(200).json({
      message: "Chat status updated",
      chat: updatedChat,
    });
  } catch (err) {
    console.error("Update chat status error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/chats/stats - Get chat statistics
router.get("/stats/overview", authenticate, async (req, res) => {
  try {
    const userId = req.user._id;

    const stats = await Chat.aggregate([
      { $match: { participants: userId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get unread message count
    const unreadCount = await Message.countDocuments({
      chat: { $in: await Chat.distinct("_id", { participants: userId }) },
      sender: { $ne: userId },
      status: { $ne: "read" },
    });

    const statsObj = {
      total: 0,
      active: 0,
      archived: 0,
      blocked: 0,
      unreadMessages: unreadCount,
    };

    stats.forEach((stat) => {
      statsObj[stat._id] = stat.count;
      statsObj.total += stat.count;
    });

    res.status(200).json({ stats: statsObj });
  } catch (err) {
    console.error("Get chat stats error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;