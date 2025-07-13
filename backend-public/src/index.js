// backend/server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables first
dotenv.config();

// Validate critical environment variables before starting
const requiredEnvVars = ["MONGO_URI", "JWT_SECRET"];
const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
);

if (missingEnvVars.length > 0) {
  console.error("❌ Missing required environment variables:", missingEnvVars);
  console.error(
    "Please check your .env file and ensure all required variables are set."
  );
  process.exit(1);
}

console.log("✅ Environment variables loaded successfully");
console.log("📊 Environment:", process.env.NODE_ENV || "development");

const app = express();

// Enhanced CORS configuration for production
const corsOptions = {
  origin: function (origin, callback) {
    console.log("🌐 CORS request from origin:", origin);

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log("✅ Allowing request with no origin");
      return callback(null, true);
    }

    const allowedOrigins = [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://localhost:3000",
      "https://localhost:5173",
      process.env.FRONTEND_URL,
      // Add your actual Vercel URL here - replace with your real URL
      "https://lokreach.vercel.app",
    ].filter(Boolean);

    console.log("🔍 Checking against allowed origins:", allowedOrigins);

    // Allow any vercel.app subdomain or explicitly allowed origins
    if (origin.includes(".vercel.app") || allowedOrigins.includes(origin)) {
      console.log("✅ Origin allowed:", origin);
      return callback(null, true);
    }

    console.log("❌ Origin not allowed:", origin);
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
  optionsSuccessStatus: 200,
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options("*", cors(corsOptions));

// Body parsing middleware with size limits
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`📝 ${timestamp} - ${req.method} ${req.path}`);

  // Log headers in development
  if (process.env.NODE_ENV === "development") {
    console.log("📋 Headers:", JSON.stringify(req.headers, null, 2));
  }

  // Log body (excluding sensitive data)
  if (req.body && Object.keys(req.body).length > 0) {
    const logBody = { ...req.body };
    if (logBody.password) logBody.password = "[HIDDEN]";
    if (logBody.adminSecret) logBody.adminSecret = "[HIDDEN]";
    console.log("📦 Body:", JSON.stringify(logBody, null, 2));
  }

  next();
});

// Health check endpoint - must be before other routes
app.get("/health", (req, res) => {
  console.log("🏥 Health check requested");
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    cors: "enabled",
    mongodb:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptime: process.uptime(),
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    message: "LocoLab API Server",
    version: "1.0.0",
    status: "running",
    endpoints: {
      health: "/health",
      auth: "/api/auth",
      creators: "/api/creators",
      campaigns: "/api/campaigns",
      admin: "/api/admin",
    },
  });
});

// Import route modules with error handling
let authRoutes, creatorRoutes, campaignRoutes, adminRoutes;

try {
  authRoutes = require("./routes/auth");
  console.log("✅ Auth routes loaded");
} catch (error) {
  console.error("❌ Error loading auth routes:", error.message);
  process.exit(1);
}

try {
  creatorRoutes = require("./routes/creator");
  console.log("✅ Creator routes loaded");
} catch (error) {
  console.error("❌ Error loading creator routes:", error.message);
  process.exit(1);
}

try {
  campaignRoutes = require("./routes/campaign");
  console.log("✅ Campaign routes loaded");
} catch (error) {
  console.error("❌ Error loading campaign routes:", error.message);
  process.exit(1);
}

try {
  adminRoutes = require("./routes/admin");
  console.log("✅ Admin routes loaded");
} catch (error) {
  console.error("❌ Error loading admin routes:", error.message);
  process.exit(1);
}

// API Routes with logging
app.use(
  "/api/auth",
  (req, res, next) => {
    console.log("🔐 Auth route accessed:", req.method, req.path);
    next();
  },
  authRoutes
);

app.use(
  "/api/creators",
  (req, res, next) => {
    console.log("👥 Creator route accessed:", req.method, req.path);
    next();
  },
  creatorRoutes
);

app.use(
  "/api/campaigns",
  (req, res, next) => {
    console.log("📢 Campaign route accessed:", req.method, req.path);
    next();
  },
  campaignRoutes
);

app.use(
  "/api/admin",
  (req, res, next) => {
    console.log("⚙️ Admin route accessed:", req.method, req.path);
    next();
  },
  adminRoutes
);

// Static file serving for uploads
const uploadsPath = path.join(__dirname, "../uploads");
app.use("/uploads", express.static(uploadsPath));
console.log("📁 Static uploads directory:", uploadsPath);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("💥 Error occurred:", {
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({
      error: "CORS error",
      message: "Origin not allowed",
      origin: req.headers.origin,
    });
  }

  // Handle specific Express errors
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      error: "Invalid JSON",
      message: "Request body contains invalid JSON",
    });
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({
      error: "Payload too large",
      message: "Request body exceeds size limit",
    });
  }

  res.status(500).json({
    error: "Internal server error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong",
    timestamp: new Date().toISOString(),
  });
});

// 404 handler for unmatched routes
app.use("*", (req, res) => {
  console.log("❓ 404 - Route not found:", {
    url: req.originalUrl,
    method: req.method,
    headers: req.headers,
    timestamp: new Date().toISOString(),
  });

  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: [
      "GET /health",
      "GET /",
      "POST /api/auth/signup",
      "POST /api/auth/signin",
      "GET /api/creators",
      "POST /api/campaigns",
    ],
  });
});

const PORT = process.env.PORT || 5000;

// MongoDB connection with enhanced error handling
console.log("🔌 Connecting to MongoDB...");
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
  })
  .then(() => {
    console.log("✅ Connected to MongoDB successfully");

    // Start server only after successful DB connection
    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log("🚀 Server started successfully!");
      console.log(`📍 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || "Not set"}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log("🎯 Ready to accept requests!");
    });

    // Graceful shutdown handling
    process.on("SIGTERM", () => {
      console.log("📴 SIGTERM received, shutting down gracefully...");
      server.close(() => {
        console.log("✅ Server closed");
        mongoose.connection.close(false, () => {
          console.log("✅ MongoDB connection closed");
          process.exit(0);
        });
      });
    });

    process.on("SIGINT", () => {
      console.log("📴 SIGINT received, shutting down gracefully...");
      server.close(() => {
        console.log("✅ Server closed");
        mongoose.connection.close(false, () => {
          console.log("✅ MongoDB connection closed");
          process.exit(0);
        });
      });
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", {
      message: err.message,
      code: err.code,
      name: err.name,
    });
    console.error("🔍 Please check:");
    console.error("  - MongoDB URI is correct");
    console.error("  - Database is accessible");
    console.error("  - Network connectivity");
    console.error("  - Authentication credentials");
    process.exit(1);
  });

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled Rejection at:", promise, "reason:", reason);
  // Close server & exit process
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("💥 Uncaught Exception:", error);
  process.exit(1);
});
