// backend/models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      enum: ["creator", "brand", "admin"],
      required: true,
    },

    // Brand-specific fields
    brandName: {
      type: String,
      trim: true,
      required: function () {
        return this.role === "brand";
      },
    },
    contactNumber: {
      type: String,
      trim: true,
      required: function () {
        return this.role === "brand" || this.role === "creator";
      },
    },
    niche: {
      type: String,
      trim: true,
      required: function () {
        return this.role === "brand" || this.role === "creator";
      },
    },
    // Optional for brands
    businessWebsite: {
      type: String,
      trim: true,
      lowercase: true,
    },
    instaLink: {
      type: String,
      trim: true,
      lowercase: true,
    },

    // Creator-specific fields
    state: {
      type: String,
      trim: true,
      required: function () {
        return this.role === "creator";
      },
    },
    city: {
      type: String,
      trim: true,
      required: function () {
        return this.role === "creator";
      },
    },
    instaUsername: {
      type: String,
      trim: true,
      lowercase: true,
      required: function () {
        return this.role === "creator";
      },
    },

    // Common fields
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: function () {
        return this.role === "admin" ? "approved" : "pending";
      },
    },
    scrapedData: {
      followers: Number,
      totalUploads: Number,
      avgLikes: Number,
      avgComments: Number,
      postsPerWeek: Number,
      engagementRate: String,
      profileHD: String,
      post1: String,
      post2: String,
      post3: String,
    },
    rejectionNote: {
      type: String,
      default: "",
    },

    resetToken: String,
    resetTokenExpiry: Date,
  },
  {
    timestamps: true,
  }
);

// Pre-save normalization
userSchema.pre("save", function (next) {
  if (this.email) this.email = this.email.toLowerCase().trim();
  if (this.instaUsername)
    this.instaUsername = this.instaUsername.toLowerCase().trim();
  if (this.instaLink) this.instaLink = this.instaLink.toLowerCase().trim();
  if (this.businessWebsite)
    this.businessWebsite = this.businessWebsite.toLowerCase().trim();
  if (this.brandName) this.brandName = this.brandName.trim();
  if (this.contactNumber) this.contactNumber = this.contactNumber.trim();
  if (this.niche) this.niche = this.niche.trim();
  if (this.state) this.state = this.state.trim();
  if (this.city) this.city = this.city.trim();
  next();
});

// Static method for Instagram username availability
userSchema.statics.isInstaUsernameAvailable = async function (
  instaUsername,
  excludeUserId = null
) {
  if (!instaUsername) return false;
  const query = { instaUsername: instaUsername.toLowerCase().trim() };
  if (excludeUserId) {
    query._id = { $ne: excludeUserId };
  }
  const existingUser = await this.findOne(query);
  return !existingUser;
};

userSchema.index({ email: 1 });
userSchema.index({ instaUsername: 1 });
userSchema.index({ role: 1 });
userSchema.index({ contactNumber: 1 });

module.exports = mongoose.model("User", userSchema);
