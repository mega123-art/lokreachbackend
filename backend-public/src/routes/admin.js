// const express = require("express");
// const router = express.Router();
// const User = require("../models/User");

// const { authenticate, authorizeRoles } = require("../middleware/auth");

// // ============ CREATOR ROUTES ============

// // GET /api/admin/creators/pending - Get all pending creators with their scraped data
// router.get(
//   "/creators/pending",
//   authenticate,
//   authorizeRoles("admin"),
//   async (req, res) => {
//     try {
//       const pendingCreators = await User.find({
//         role: "creator",
//         status: "pending",
//       }).select("-password -resetToken -resetTokenExpiry");

//       res.status(200).json({
//         pendingCreators,
//         count: pendingCreators.length,
//       });
//     } catch (err) {
//       console.error("Error fetching pending creators:", err);
//       res.status(500).json({ error: "Server error" });
//     }
//   }
// );

// // GET /api/admin/creators/approved - Get all approved creators
// router.get(
//   "/creators/approved",
//   authenticate,
//   authorizeRoles("admin"),
//   async (req, res) => {
//     try {
//       const approvedCreators = await User.find({
//         role: "creator",
//         status: "approved",
//       }).select("-password -resetToken -resetTokenExpiry");

//       res.status(200).json({
//         approvedCreators,
//         count: approvedCreators.length,
//       });
//     } catch (err) {
//       console.error("Error fetching approved creators:", err);
//       res.status(500).json({ error: "Server error" });
//     }
//   }
// );

// // GET /api/admin/creators/rejected - Get all rejected creators
// router.get(
//   "/creators/rejected",
//   authenticate,
//   authorizeRoles("admin"),
//   async (req, res) => {
//     try {
//       const rejectedCreators = await User.find({
//         role: "creator",
//         status: "rejected",
//       }).select("-password -resetToken -resetTokenExpiry");

//       res.status(200).json({
//         rejectedCreators,
//         count: rejectedCreators.length,
//       });
//     } catch (err) {
//       console.error("Error fetching rejected creators:", err);
//       res.status(500).json({ error: "Server error" });
//     }
//   }
// );

// // GET /api/admin/creators/:creatorId - Get specific creator with full details
// router.get(
//   "/creators/:creatorId",
//   authenticate,
//   authorizeRoles("admin"),
//   async (req, res) => {
//     try {
//       const { creatorId } = req.params;

//       const creator = await User.findById(creatorId).select(
//         "-password -resetToken -resetTokenExpiry"
//       );

//       if (!creator || creator.role !== "creator") {
//         return res.status(404).json({ error: "Creator not found" });
//       }

//       // Include comment verification status in response
//       const responseData = {
//         creator: {
//           ...creator.toObject(),
//           commentVerificationStatus: creator.commentVerification?.verified || false,
//           verificationDetails: creator.commentVerification || null
//         }
//       };
//       res.status(200).json(responseData);
//     } catch (err) {
//       console.error("Error fetching creator details:", err);
//       res.status(500).json({ error: "Server error" });
//     }
//   }
// );

// // PATCH /api/admin/creators/:creatorId/approve - Approve a creator
// router.patch(
//   "/creators/:creatorId/approve",
//   authenticate,
//   authorizeRoles("admin"),
//   async (req, res) => {
//     try {
//       const { creatorId } = req.params;
//       const { approvalNote } = req.body;

//       const creator = await User.findById(creatorId);

//       if (!creator || creator.role !== "creator") {
//         return res.status(404).json({ error: "Creator not found" });
//       }

//       if (creator.status === "approved") {
//         return res.status(400).json({ error: "Creator is already approved" });
//       }

//       creator.status = "approved";
//       creator.rejectionNote = "";

//       // Note: approvalNote field needs to be added to User model
//       if (approvalNote) {
//         creator.approvalNote = approvalNote;
//       }

//       await creator.save();

//       res.status(200).json({
//         message: "Creator approved successfully",
//         creator: {
//           id: creator._id,
//           email: creator.email,
//           instaUsername: creator.instaUsername, // Fixed: was username
//           status: creator.status,
//           approvedAt: new Date(),
//         },
//       });
//     } catch (err) {
//       console.error("Error approving creator:", err);
//       res.status(500).json({ error: "Server error" });
//     }
//   }
// );

// // PATCH /api/admin/creators/:creatorId/reject - Reject a creator
// router.patch(
//   "/creators/:creatorId/reject",
//   authenticate,
//   authorizeRoles("admin"),
//   async (req, res) => {
//     try {
//       const { creatorId } = req.params;
//       const { rejectionNote } = req.body;

//       if (!rejectionNote || rejectionNote.trim() === "") {
//         return res.status(400).json({
//           error: "Rejection note is required when rejecting a creator",
//         });
//       }

//       const creator = await User.findById(creatorId);

//       if (!creator || creator.role !== "creator") {
//         return res.status(404).json({ error: "Creator not found" });
//       }

//       if (creator.status === "rejected") {
//         return res.status(400).json({ error: "Creator is already rejected" });
//       }

//       creator.status = "rejected";
//       creator.rejectionNote = rejectionNote.trim();

//       await creator.save();

//       res.status(200).json({
//         message: "Creator rejected successfully",
//         creator: {
//           id: creator._id,
//           email: creator.email,
//           instaUsername: creator.instaUsername, // Fixed: was username
//           status: creator.status,
//           rejectionNote: creator.rejectionNote,
//           rejectedAt: new Date(),
//         },
//       });
//     } catch (err) {
//       console.error("Error rejecting creator:", err);
//       res.status(500).json({ error: "Server error" });
//     }
//   }
// );

// // GET /api/admin/creators/stats - Get creator statistics
// router.get(
//   "/creators/stats",
//   authenticate,
//   authorizeRoles("admin"),
//   async (req, res) => {
//     try {
//       const stats = await User.aggregate([
//         { $match: { role: "creator" } },
//         {
//           $group: {
//             _id: "$status",
//             count: { $sum: 1 },
//           },
//         },
//       ]);

//       const totalCreators = await User.countDocuments({ role: "creator" });

//       const statsObj = {
//         total: totalCreators,
//         pending: 0,
//         approved: 0,
//         rejected: 0,
//       };

//       stats.forEach((stat) => {
//         statsObj[stat._id] = stat.count;
//       });

//       res.status(200).json({ stats: statsObj });
//     } catch (err) {
//       console.error("Error fetching creator stats:", err);
//       res.status(500).json({ error: "Server error" });
//     }
//   }
// );

// // GET /api/admin/creators - Get all creators with filtering and pagination
// router.get(
//   "/creators",
//   authenticate,
//   authorizeRoles("admin"),
//   async (req, res) => {
//     try {
//       const {
//         status,
//         page = 1,
//         limit = 10,
//         sortBy = "createdAt",
//         sortOrder = "desc",
//         search,
//       } = req.query;

//       const query = { role: "creator" };

//       if (status && ["pending", "approved", "rejected"].includes(status)) {
//         query.status = status;
//       }

//       if (search) {
//         query.$or = [
//           { email: { $regex: search, $options: "i" } },
//           { instaUsername: { $regex: search, $options: "i" } }, // Fixed: was instaHandle
//           { state: { $regex: search, $options: "i" } },
//           { city: { $regex: search, $options: "i" } },
//           { niche: { $regex: search, $options: "i" } },
//         ];
//       }

//       const skip = (page - 1) * limit;
//       const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

//       const creators = await User.find(query)
//         .select("-password -resetToken -resetTokenExpiry")
//         .sort(sort)
//         .skip(skip)
//         .limit(parseInt(limit));

//       const totalCount = await User.countDocuments(query);
//       const totalPages = Math.ceil(totalCount / limit);

//       res.status(200).json({
//         creators,
//         pagination: {
//           currentPage: parseInt(page),
//           totalPages,
//           totalCount,
//           hasNext: page < totalPages,
//           hasPrev: page > 1,
//         },
//       });
//     } catch (err) {
//       console.error("Error fetching creators:", err);
//       res.status(500).json({ error: "Server error" });
//     }
//   }
// );

// // ============ BRAND ROUTES ============

// // GET /api/admin/brands/pending - Get all pending brands
// router.get(
//   "/brands/pending",
//   authenticate,
//   authorizeRoles("admin"),
//   async (req, res) => {
//     try {
//       const pendingBrands = await User.find({
//         role: "brand",
//         status: "pending",
//       }).select("-password -resetToken -resetTokenExpiry");

//       res.status(200).json({
//         pendingBrands,
//         count: pendingBrands.length,
//       });
//     } catch (err) {
//       console.error("Error fetching pending brands:", err);
//       res.status(500).json({ error: "Server error" });
//     }
//   }
// );

// // GET /api/admin/brands/approved - Get all approved brands
// router.get(
//   "/brands/approved",
//   authenticate,
//   authorizeRoles("admin"),
//   async (req, res) => {
//     try {
//       const approvedBrands = await User.find({
//         role: "brand",
//         status: "approved",
//       }).select("-password -resetToken -resetTokenExpiry");

//       res.status(200).json({
//         approvedBrands,
//         count: approvedBrands.length,
//       });
//     } catch (err) {
//       console.error("Error fetching approved brands:", err);
//       res.status(500).json({ error: "Server error" });
//     }
//   }
// );

// // GET /api/admin/brands/rejected - Get all rejected brands
// router.get(
//   "/brands/rejected",
//   authenticate,
//   authorizeRoles("admin"),
//   async (req, res) => {
//     try {
//       const rejectedBrands = await User.find({
//         role: "brand",
//         status: "rejected",
//       }).select("-password -resetToken -resetTokenExpiry");

//       res.status(200).json({
//         rejectedBrands,
//         count: rejectedBrands.length,
//       });
//     } catch (err) {
//       console.error("Error fetching rejected brands:", err);
//       res.status(500).json({ error: "Server error" });
//     }
//   }
// );

// // GET /api/admin/brands/:brandId - Get specific brand with full details
// router.get(
//   "/brands/:brandId",
//   authenticate,
//   authorizeRoles("admin"),
//   async (req, res) => {
//     try {
//       const { brandId } = req.params;

//       const brand = await User.findById(brandId).select(
//         "-password -resetToken -resetTokenExpiry"
//       );

//       if (!brand || brand.role !== "brand") {
//         return res.status(404).json({ error: "Brand not found" });
//       }

//       res.status(200).json({ brand });
//     } catch (err) {
//       console.error("Error fetching brand details:", err);
//       res.status(500).json({ error: "Server error" });
//     }
//   }
// );

// // PATCH /api/admin/brands/:brandId/approve - Approve a brand
// router.patch(
//   "/brands/:brandId/approve",
//   authenticate,
//   authorizeRoles("admin"),
//   async (req, res) => {
//     try {
//       const { brandId } = req.params;
//       const { approvalNote } = req.body;

//       const brand = await User.findById(brandId);

//       if (!brand || brand.role !== "brand") {
//         return res.status(404).json({ error: "Brand not found" });
//       }

//       if (brand.status === "approved") {
//         return res.status(400).json({ error: "Brand is already approved" });
//       }

//       brand.status = "approved";
//       brand.rejectionNote = "";

//       // Note: approvalNote field needs to be added to User model
//       if (approvalNote) {
//         brand.approvalNote = approvalNote;
//       }

//       await brand.save();

//       res.status(200).json({
//         message: "Brand approved successfully",
//         brand: {
//           id: brand._id,
//           email: brand.email,
//           brandName: brand.brandName,
//           status: brand.status,
//           approvedAt: new Date(),
//         },
//       });
//     } catch (err) {
//       console.error("Error approving brand:", err);
//       res.status(500).json({ error: "Server error" });
//     }
//   }
// );

// // PATCH /api/admin/brands/:brandId/reject - Reject a brand
// router.patch(
//   "/brands/:brandId/reject",
//   authenticate,
//   authorizeRoles("admin"),
//   async (req, res) => {
//     try {
//       const { brandId } = req.params;
//       const { rejectionNote } = req.body;

//       if (!rejectionNote || rejectionNote.trim() === "") {
//         return res.status(400).json({
//           error: "Rejection note is required when rejecting a brand",
//         });
//       }

//       const brand = await User.findById(brandId);

//       if (!brand || brand.role !== "brand") {
//         return res.status(404).json({ error: "Brand not found" });
//       }

//       if (brand.status === "rejected") {
//         return res.status(400).json({ error: "Brand is already rejected" });
//       }

//       brand.status = "rejected";
//       brand.rejectionNote = rejectionNote.trim();

//       await brand.save();

//       res.status(200).json({
//         message: "Brand rejected successfully",
//         brand: {
//           id: brand._id,
//           email: brand.email,
//           brandName: brand.brandName,
//           status: brand.status,
//           rejectionNote: brand.rejectionNote,
//           rejectedAt: new Date(),
//         },
//       });
//     } catch (err) {
//       console.error("Error rejecting brand:", err);
//       res.status(500).json({ error: "Server error" });
//     }
//   }
// );

// // GET /api/admin/brands/stats - Get brand statistics
// router.get(
//   "/brands/stats",
//   authenticate,
//   authorizeRoles("admin"),
//   async (req, res) => {
//     try {
//       const stats = await User.aggregate([
//         { $match: { role: "brand" } },
//         {
//           $group: {
//             _id: "$status",
//             count: { $sum: 1 },
//           },
//         },
//       ]);

//       const totalBrands = await User.countDocuments({ role: "brand" });

//       const statsObj = {
//         total: totalBrands,
//         pending: 0,
//         approved: 0,
//         rejected: 0,
//       };

//       stats.forEach((stat) => {
//         statsObj[stat._id] = stat.count;
//       });

//       res.status(200).json({ stats: statsObj });
//     } catch (err) {
//       console.error("Error fetching brand stats:", err);
//       res.status(500).json({ error: "Server error" });
//     }
//   }
// );

// // GET /api/admin/brands - Get all brands with filtering and pagination
// router.get(
//   "/brands",
//   authenticate,
//   authorizeRoles("admin"),
//   async (req, res) => {
//     try {
//       const {
//         status,
//         page = 1,
//         limit = 10,
//         sortBy = "createdAt",
//         sortOrder = "desc",
//         search,
//       } = req.query;

//       const query = { role: "brand" };

//       if (status && ["pending", "approved", "rejected"].includes(status)) {
//         query.status = status;
//       }

//       if (search) {
//         query.$or = [
//           { email: { $regex: search, $options: "i" } },
//           { brandName: { $regex: search, $options: "i" } },
//           { niche: { $regex: search, $options: "i" } }, // Fixed: was businessNiche
//           { businessWebsite: { $regex: search, $options: "i" } },
//           { instaLink: { $regex: search, $options: "i" } },
//         ];
//       }

//       const skip = (page - 1) * limit;
//       const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

//       const brands = await User.find(query)
//         .select("-password -resetToken -resetTokenExpiry")
//         .sort(sort)
//         .skip(skip)
//         .limit(parseInt(limit));

//       const totalCount = await User.countDocuments(query);
//       const totalPages = Math.ceil(totalCount / limit);

//       res.status(200).json({
//         brands,
//         pagination: {
//           currentPage: parseInt(page),
//           totalPages,
//           totalCount,
//           hasNext: page < totalPages,
//           hasPrev: page > 1,
//         },
//       });
//     } catch (err) {
//       console.error("Error fetching brands:", err);
//       res.status(500).json({ error: "Server error" });
//     }
//   }
// );

// // ============ COMBINED ROUTES ============

// // GET /api/admin/users/stats - Get combined user statistics
// router.get(
//   "/users/stats",
//   authenticate,
//   authorizeRoles("admin"),
//   async (req, res) => {
//     try {
//       const stats = await User.aggregate([
//         { $match: { role: { $in: ["creator", "brand"] } } },
//         {
//           $group: {
//             _id: { role: "$role", status: "$status" },
//             count: { $sum: 1 },
//           },
//         },
//       ]);

//       const totalUsers = await User.countDocuments({
//         role: { $in: ["creator", "brand"] },
//       });

//       const statsObj = {
//         total: totalUsers,
//         creators: { total: 0, pending: 0, approved: 0, rejected: 0 },
//         brands: { total: 0, pending: 0, approved: 0, rejected: 0 },
//       };

//       stats.forEach((stat) => {
//         const role = stat._id.role;
//         const status = stat._id.status;
//         if (role === "creator") {
//           statsObj.creators[status] = stat.count;
//           statsObj.creators.total += stat.count;
//         } else if (role === "brand") {
//           statsObj.brands[status] = stat.count;
//           statsObj.brands.total += stat.count;
//         }
//       });

//       res.status(200).json({ stats: statsObj });
//     } catch (err) {
//       console.error("Error fetching combined stats:", err);
//       res.status(500).json({ error: "Server error" });
//     }
//   }
// );

// // GET /api/admin/users/pending - Get all pending users (creators and brands)
// router.get(
//   "/users/pending",
//   authenticate,
//   authorizeRoles("admin"),
//   async (req, res) => {
//     try {
//       const pendingUsers = await User.find({
//         role: { $in: ["creator", "brand"] },
//         status: "pending",
//       }).select("-password -resetToken -resetTokenExpiry");

//       res.status(200).json({
//         pendingUsers,
//         count: pendingUsers.length,
//       });
//     } catch (err) {
//       console.error("Error fetching pending users:", err);
//       res.status(500).json({ error: "Server error" });
//     }
//   }
// );

// // PATCH /api/admin/users/bulk-action - Bulk approve/reject multiple users
// router.patch(
//   "/users/bulk-action",
//   authenticate,
//   authorizeRoles("admin"),
//   async (req, res) => {
//     try {
//       const { userIds, action, note } = req.body;

//       if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
//         return res.status(400).json({ error: "User IDs array is required" });
//       }

//       if (!["approve", "reject", "pending"].includes(action)) {
//         return res.status(400).json({
//           error: "Invalid action. Must be 'approve', 'reject', or 'pending'",
//         });
//       }

//       if (action === "reject" && (!note || note.trim() === "")) {
//         return res.status(400).json({
//           error: "Rejection note is required when rejecting users",
//         });
//       }

//       const statusMap = {
//         approve: "approved",
//         reject: "rejected",
//         pending: "pending",
//       };

//       const updateData = { status: statusMap[action] };

//       if (action === "reject") {
//         updateData.rejectionNote = note.trim();
//       } else if (action === "approve") {
//         updateData.rejectionNote = "";
//       }

//       const result = await User.updateMany(
//         {
//           _id: { $in: userIds },
//           role: { $in: ["creator", "brand"] },
//         },
//         updateData
//       );

//       res.status(200).json({
//         message: `Successfully ${action}ed ${result.modifiedCount} users`,
//         modifiedCount: result.modifiedCount,
//       });
//     } catch (err) {
//       console.error("Error performing bulk action:", err);
//       res.status(500).json({ error: "Server error" });
//     }
//   }
// );

// // PATCH /api/admin/users/:userId/status - Update user status (works for both creators and brands)
// router.patch(
//   "/users/:userId/status",
//   authenticate,
//   authorizeRoles("admin"),
//   async (req, res) => {
//     try {
//       const { userId } = req.params;
//       const { status, note } = req.body;

//       if (!["pending", "approved", "rejected"].includes(status)) {
//         return res.status(400).json({
//           error: "Invalid status. Must be 'pending', 'approved', or 'rejected'",
//         });
//       }

//       if (status === "rejected" && (!note || note.trim() === "")) {
//         return res.status(400).json({
//           error: "Rejection note is required when rejecting a user",
//         });
//       }

//       const user = await User.findById(userId);

//       if (!user || !["creator", "brand"].includes(user.role)) {
//         return res.status(404).json({ error: "User not found" });
//       }

//       user.status = status;

//       if (status === "rejected") {
//         user.rejectionNote = note.trim();
//       } else if (status === "approved") {
//         user.rejectionNote = "";
//       }

//       await user.save();

//       res.status(200).json({
//         message: `${user.role} ${status} successfully`,
//         user: {
//           id: user._id,
//           email: user.email,
//           role: user.role,
//           status: user.status,
//           rejectionNote: user.rejectionNote,
//           updatedAt: new Date(),
//         },
//       });
//     } catch (err) {
//       console.error("Error updating user status:", err);
//       res.status(500).json({ error: "Server error" });
//     }
//   }
// );

// module.exports = router;
const express = require("express");
const router = express.Router();
const User = require("../models/User");

const { authenticate, authorizeRoles } = require("../middleware/auth");

// ============ CREATOR ROUTES ============

// GET /api/admin/creators/active - Get all active creators with their scraped data
router.get(
  "/creators/active",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const activeCreators = await User.find({
        role: "creator",
        status: "active",
      }).select("-password -resetToken -resetTokenExpiry");

      res.status(200).json({
        activeCreators,
        count: activeCreators.length,
      });
    } catch (err) {
      console.error("Error fetching active creators:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// GET /api/admin/creators/banned - Get all banned creators
router.get(
  "/creators/banned",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const bannedCreators = await User.find({
        role: "creator",
        status: "banned",
      }).select("-password -resetToken -resetTokenExpiry");

      res.status(200).json({
        bannedCreators,
        count: bannedCreators.length,
      });
    } catch (err) {
      console.error("Error fetching banned creators:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// GET /api/admin/creators/:creatorId - Get specific creator with full details
router.get(
  "/creators/:creatorId",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { creatorId } = req.params;

      const creator = await User.findById(creatorId).select(
        "-password -resetToken -resetTokenExpiry"
      );

      if (!creator || creator.role !== "creator") {
        return res.status(404).json({ error: "Creator not found" });
      }

      // Include comment verification status in response
      const responseData = {
        creator: {
          ...creator.toObject(),
          commentVerificationStatus: creator.commentVerification?.verified || false,
          verificationDetails: creator.commentVerification || null
        }
      };
      res.status(200).json(responseData);
    } catch (err) {
      console.error("Error fetching creator details:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// PATCH /api/admin/creators/:creatorId/ban - Ban a creator
router.patch(
  "/creators/:creatorId/ban",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { creatorId } = req.params;
      const { banReason } = req.body;

      if (!banReason || banReason.trim() === "") {
        return res.status(400).json({
          error: "Ban reason is required when banning a creator",
        });
      }

      const creator = await User.findById(creatorId);

      if (!creator || creator.role !== "creator") {
        return res.status(404).json({ error: "Creator not found" });
      }

      if (creator.status === "banned") {
        return res.status(400).json({ error: "Creator is already banned" });
      }

      creator.status = "banned";
      creator.banReason = banReason.trim();
      creator.bannedAt = new Date();
      creator.bannedBy = req.user.id; // Admin who banned the user

      await creator.save();

      res.status(200).json({
        message: "Creator banned successfully",
        creator: {
          id: creator._id,
          email: creator.email,
          instaUsername: creator.instaUsername, // Fixed: was username
          status: creator.status,
          banReason: creator.banReason,
          bannedAt: creator.bannedAt,
        },
      });
    } catch (err) {
      console.error("Error banning creator:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// PATCH /api/admin/creators/:creatorId/unban - Unban a creator
router.patch(
  "/creators/:creatorId/unban",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { creatorId } = req.params;

      const creator = await User.findById(creatorId);

      if (!creator || creator.role !== "creator") {
        return res.status(404).json({ error: "Creator not found" });
      }

      if (creator.status === "active") {
        return res.status(400).json({ error: "Creator is not banned" });
      }

      creator.status = "active";
      creator.banReason = "";
      creator.bannedAt = undefined;
      creator.bannedBy = undefined;

      await creator.save();

      res.status(200).json({
        message: "Creator unbanned successfully",
        creator: {
          id: creator._id,
          email: creator.email,
          instaUsername: creator.instaUsername, // Fixed: was username
          status: creator.status,
          unbannedAt: new Date(),
        },
      });
    } catch (err) {
      console.error("Error unbanning creator:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// GET /api/admin/creators/stats - Get creator statistics
router.get(
  "/creators/stats",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const stats = await User.aggregate([
        { $match: { role: "creator" } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]);

      const totalCreators = await User.countDocuments({ role: "creator" });

      const statsObj = {
        total: totalCreators,
        active: 0,
        banned: 0,
      };

      stats.forEach((stat) => {
        statsObj[stat._id] = stat.count;
      });

      res.status(200).json({ stats: statsObj });
    } catch (err) {
      console.error("Error fetching creator stats:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// GET /api/admin/creators - Get all creators with filtering and pagination
router.get(
  "/creators",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const {
        status,
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
        search,
      } = req.query;

      const query = { role: "creator" };

      if (status && ["active", "banned"].includes(status)) {
        query.status = status;
      }

      if (search) {
        query.$or = [
          { email: { $regex: search, $options: "i" } },
          { instaUsername: { $regex: search, $options: "i" } }, // Fixed: was instaHandle
          { state: { $regex: search, $options: "i" } },
          { city: { $regex: search, $options: "i" } },
          { niche: { $regex: search, $options: "i" } },
        ];
      }

      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

      const creators = await User.find(query)
        .select("-password -resetToken -resetTokenExpiry")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit));

      const totalCount = await User.countDocuments(query);
      const totalPages = Math.ceil(totalCount / limit);

      res.status(200).json({
        creators,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      });
    } catch (err) {
      console.error("Error fetching creators:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// ============ BRAND ROUTES ============

// GET /api/admin/brands/active - Get all active brands
router.get(
  "/brands/active",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const activeBrands = await User.find({
        role: "brand",
        status: "active",
      }).select("-password -resetToken -resetTokenExpiry");

      res.status(200).json({
        activeBrands,
        count: activeBrands.length,
      });
    } catch (err) {
      console.error("Error fetching active brands:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// GET /api/admin/brands/banned - Get all banned brands
router.get(
  "/brands/banned",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const bannedBrands = await User.find({
        role: "brand",
        status: "banned",
      }).select("-password -resetToken -resetTokenExpiry");

      res.status(200).json({
        bannedBrands,
        count: bannedBrands.length,
      });
    } catch (err) {
      console.error("Error fetching banned brands:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// GET /api/admin/brands/:brandId - Get specific brand with full details
router.get(
  "/brands/:brandId",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { brandId } = req.params;

      const brand = await User.findById(brandId).select(
        "-password -resetToken -resetTokenExpiry"
      );

      if (!brand || brand.role !== "brand") {
        return res.status(404).json({ error: "Brand not found" });
      }

      res.status(200).json({ brand });
    } catch (err) {
      console.error("Error fetching brand details:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// PATCH /api/admin/brands/:brandId/ban - Ban a brand
router.patch(
  "/brands/:brandId/ban",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { brandId } = req.params;
      const { banReason } = req.body;

      if (!banReason || banReason.trim() === "") {
        return res.status(400).json({
          error: "Ban reason is required when banning a brand",
        });
      }

      const brand = await User.findById(brandId);

      if (!brand || brand.role !== "brand") {
        return res.status(404).json({ error: "Brand not found" });
      }

      if (brand.status === "banned") {
        return res.status(400).json({ error: "Brand is already banned" });
      }

      brand.status = "banned";
      brand.banReason = banReason.trim();
      brand.bannedAt = new Date();
      brand.bannedBy = req.user.id;

      await brand.save();

      res.status(200).json({
        message: "Brand banned successfully",
        brand: {
          id: brand._id,
          email: brand.email,
          brandName: brand.brandName,
          status: brand.status,
          banReason: brand.banReason,
          bannedAt: brand.bannedAt,
        },
      });
    } catch (err) {
      console.error("Error banning brand:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// PATCH /api/admin/brands/:brandId/unban - Unban a brand
router.patch(
  "/brands/:brandId/unban",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { brandId } = req.params;

      const brand = await User.findById(brandId);

      if (!brand || brand.role !== "brand") {
        return res.status(404).json({ error: "Brand not found" });
      }

      if (brand.status === "active") {
        return res.status(400).json({ error: "Brand is not banned" });
      }

      brand.status = "active";
      brand.banReason = "";
      brand.bannedAt = undefined;
      brand.bannedBy = undefined;

      await brand.save();

      res.status(200).json({
        message: "Brand unbanned successfully",
        brand: {
          id: brand._id,
          email: brand.email,
          brandName: brand.brandName,
          status: brand.status,
          unbannedAt: new Date(),
        },
      });
    } catch (err) {
      console.error("Error unbanning brand:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// GET /api/admin/brands/stats - Get brand statistics
router.get(
  "/brands/stats",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const stats = await User.aggregate([
        { $match: { role: "brand" } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]);

      const totalBrands = await User.countDocuments({ role: "brand" });

      const statsObj = {
        total: totalBrands,
        active: 0,
        banned: 0,
      };

      stats.forEach((stat) => {
        statsObj[stat._id] = stat.count;
      });

      res.status(200).json({ stats: statsObj });
    } catch (err) {
      console.error("Error fetching brand stats:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// GET /api/admin/brands - Get all brands with filtering and pagination
router.get(
  "/brands",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const {
        status,
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
        search,
      } = req.query;

      const query = { role: "brand" };

      if (status && ["active", "banned"].includes(status)) {
        query.status = status;
      }

      if (search) {
        query.$or = [
          { email: { $regex: search, $options: "i" } },
          { brandName: { $regex: search, $options: "i" } },
          { niche: { $regex: search, $options: "i" } }, // Fixed: was businessNiche
          { businessWebsite: { $regex: search, $options: "i" } },
          { instaLink: { $regex: search, $options: "i" } },
        ];
      }

      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

      const brands = await User.find(query)
        .select("-password -resetToken -resetTokenExpiry")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit));

      const totalCount = await User.countDocuments(query);
      const totalPages = Math.ceil(totalCount / limit);

      res.status(200).json({
        brands,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      });
    } catch (err) {
      console.error("Error fetching brands:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// ============ COMBINED ROUTES ============

// GET /api/admin/users/stats - Get combined user statistics
router.get(
  "/users/stats",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const stats = await User.aggregate([
        { $match: { role: { $in: ["creator", "brand"] } } },
        {
          $group: {
            _id: { role: "$role", status: "$status" },
            count: { $sum: 1 },
          },
        },
      ]);

      const totalUsers = await User.countDocuments({
        role: { $in: ["creator", "brand"] },
      });

      const statsObj = {
        total: totalUsers,
        creators: { total: 0, active: 0, banned: 0 },
        brands: { total: 0, active: 0, banned: 0 },
      };

      stats.forEach((stat) => {
        const role = stat._id.role;
        const status = stat._id.status;
        if (role === "creator") {
          statsObj.creators[status] = stat.count;
          statsObj.creators.total += stat.count;
        } else if (role === "brand") {
          statsObj.brands[status] = stat.count;
          statsObj.brands.total += stat.count;
        }
      });

      res.status(200).json({ stats: statsObj });
    } catch (err) {
      console.error("Error fetching combined stats:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// GET /api/admin/users/active - Get all active users (creators and brands)
router.get(
  "/users/active",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const activeUsers = await User.find({
        role: { $in: ["creator", "brand"] },
        status: "active",
      }).select("-password -resetToken -resetTokenExpiry");

      res.status(200).json({
        activeUsers,
        count: activeUsers.length,
      });
    } catch (err) {
      console.error("Error fetching active users:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// GET /api/admin/users/banned - Get all banned users (creators and brands)
router.get(
  "/users/banned",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const bannedUsers = await User.find({
        role: { $in: ["creator", "brand"] },
        status: "banned",
      }).select("-password -resetToken -resetTokenExpiry");

      res.status(200).json({
        bannedUsers,
        count: bannedUsers.length,
      });
    } catch (err) {
      console.error("Error fetching banned users:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// PATCH /api/admin/users/bulk-action - Bulk ban/unban multiple users
router.patch(
  "/users/bulk-action",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { userIds, action, banReason } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: "User IDs array is required" });
      }

      if (!["ban", "unban"].includes(action)) {
        return res.status(400).json({
          error: "Invalid action. Must be 'ban' or 'unban'",
        });
      }

      if (action === "ban" && (!banReason || banReason.trim() === "")) {
        return res.status(400).json({
          error: "Ban reason is required when banning users",
        });
      }

      const statusMap = {
        ban: "banned",
        unban: "active",
      };

      const updateData = { status: statusMap[action] };

      if (action === "ban") {
        updateData.banReason = banReason.trim();
        updateData.bannedAt = new Date();
        updateData.bannedBy = req.user.id;
      } else if (action === "unban") {
        updateData.banReason = "";
        updateData.$unset = { bannedAt: "", bannedBy: "" };
      }

      const result = await User.updateMany(
        {
          _id: { $in: userIds },
          role: { $in: ["creator", "brand"] },
        },
        updateData
      );

      res.status(200).json({
        message: `Successfully ${action === "ban" ? "banned" : "unbanned"} ${result.modifiedCount} users`,
        modifiedCount: result.modifiedCount,
      });
    } catch (err) {
      console.error("Error performing bulk action:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// PATCH /api/admin/users/:userId/status - Update user status (works for both creators and brands)
router.patch(
  "/users/:userId/status",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { status, banReason } = req.body;

      if (!["active", "banned"].includes(status)) {
        return res.status(400).json({
          error: "Invalid status. Must be 'active' or 'banned'",
        });
      }

      if (status === "banned" && (!banReason || banReason.trim() === "")) {
        return res.status(400).json({
          error: "Ban reason is required when banning a user",
        });
      }

      const user = await User.findById(userId);

      if (!user || !["creator", "brand"].includes(user.role)) {
        return res.status(404).json({ error: "User not found" });
      }

      user.status = status;

      if (status === "banned") {
        user.banReason = banReason.trim();
        user.bannedAt = new Date();
        user.bannedBy = req.user.id;
      } else if (status === "active") {
        user.banReason = "";
        user.bannedAt = undefined;
        user.bannedBy = undefined;
      }

      await user.save();

      res.status(200).json({
        message: `${user.role} ${status === "banned" ? "banned" : "unbanned"} successfully`,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          status: user.status,
          banReason: user.banReason,
          bannedAt: user.bannedAt,
          updatedAt: new Date(),
        },
      });
    } catch (err) {
      console.error("Error updating user status:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

module.exports = router;
