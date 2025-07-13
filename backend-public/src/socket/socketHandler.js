const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Store active socket connections
const activeUsers = new Map();

const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    
    if (!user) {
      return next(new Error("Authentication error: User not found"));
    }

    socket.userId = user._id.toString();
    socket.user = user;
    next();
  } catch (err) {
    console.error("Socket authentication error:", err);
    next(new Error("Authentication error: Invalid token"));
  }
};

const handleConnection = (io) => {
  return (socket) => {
    console.log(`🔌 User connected: ${socket.user.email} (${socket.userId})`);
    
    // Store user connection
    activeUsers.set(socket.userId, {
      socketId: socket.id,
      user: socket.user,
      connectedAt: new Date(),
    });

    // Join user to their personal room for notifications
    socket.join(`user_${socket.userId}`);

    // Handle joining specific chat rooms
    socket.on("join_chat", (chatId) => {
      console.log(`👥 User ${socket.userId} joined chat: ${chatId}`);
      socket.join(`chat_${chatId}`);
      
      // Notify other participants that user is online
      socket.to(`chat_${chatId}`).emit("user_online", {
        userId: socket.userId,
        user: {
          id: socket.user._id,
          name: socket.user.brandName || socket.user.instaUsername,
          role: socket.user.role,
        },
      });
    });

    // Handle leaving chat rooms
    socket.on("leave_chat", (chatId) => {
      console.log(`👋 User ${socket.userId} left chat: ${chatId}`);
      socket.leave(`chat_${chatId}`);
      
      // Notify other participants that user left
      socket.to(`chat_${chatId}`).emit("user_offline", {
        userId: socket.userId,
      });
    });

    // Handle typing indicators
    socket.on("typing_start", (data) => {
      const { chatId } = data;
      socket.to(`chat_${chatId}`).emit("user_typing", {
        userId: socket.userId,
        user: {
          name: socket.user.brandName || socket.user.instaUsername,
          role: socket.user.role,
        },
        chatId,
      });
    });

    socket.on("typing_stop", (data) => {
      const { chatId } = data;
      socket.to(`chat_${chatId}`).emit("user_stopped_typing", {
        userId: socket.userId,
        chatId,
      });
    });

    // Handle message read receipts
    socket.on("message_read", (data) => {
      const { chatId, messageId } = data;
      socket.to(`chat_${chatId}`).emit("message_read_receipt", {
        messageId,
        readBy: socket.userId,
        readAt: new Date(),
      });
    });

    // Handle user status updates
    socket.on("update_status", (status) => {
      if (activeUsers.has(socket.userId)) {
        const userData = activeUsers.get(socket.userId);
        userData.status = status;
        activeUsers.set(socket.userId, userData);
        
        // Broadcast status to all user's chats
        socket.broadcast.emit("user_status_update", {
          userId: socket.userId,
          status,
        });
      }
    });

    // Handle disconnection
    socket.on("disconnect", (reason) => {
      console.log(`🔌 User disconnected: ${socket.user.email} (${reason})`);
      
      // Remove from active users
      activeUsers.delete(socket.userId);
      
      // Notify all rooms that user is offline
      socket.broadcast.emit("user_offline", {
        userId: socket.userId,
      });
    });

    // Handle errors
    socket.on("error", (error) => {
      console.error(`❌ Socket error for user ${socket.userId}:`, error);
    });

    // Send initial connection success
    socket.emit("connected", {
      message: "Connected successfully",
      userId: socket.userId,
      timestamp: new Date(),
    });
  };
};

// Utility functions
const getActiveUsers = () => {
  return Array.from(activeUsers.values());
};

const isUserOnline = (userId) => {
  return activeUsers.has(userId);
};

const getUserSocket = (userId) => {
  const userData = activeUsers.get(userId);
  return userData ? userData.socketId : null;
};

// Emit to specific user
const emitToUser = (io, userId, event, data) => {
  io.to(`user_${userId}`).emit(event, data);
};

// Emit to specific chat
const emitToChat = (io, chatId, event, data) => {
  io.to(`chat_${chatId}`).emit(event, data);
};

module.exports = {
  socketAuth,
  handleConnection,
  getActiveUsers,
  isUserOnline,
  getUserSocket,
  emitToUser,
  emitToChat,
};