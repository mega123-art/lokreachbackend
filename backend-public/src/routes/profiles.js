// backend/routes/profile.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Campaign = require("../models/Campaign");
const SavedProfile = require("../models/SavedProfile");

const { authenticate, authorizeRoles } = require("../middleware/auth");

// GET /api/profiles/creators - Get creator profiles with pagination, filtering, and sorting
router.get("/creators", authenticate, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      city,
      niche,
      state,
      sortBy = "createdAt",
      sortOrder = "desc",
      minFollowers,
      maxFollowers,
      minEngagement,
      maxEngagement,
      search,
    } = req.query;

    // Build filter object
    const filter = {
      role: "creator",
      status: "approved", // Only show approved creators
    };

    // Add city filter
    if (city) {
      filter.city = new RegExp(city, "i"); // Case insensitive
    }

    // Add niche filter
    if (niche) {
      filter.niche = new RegExp(niche, "i"); // Case insensitive
    }

    // Add state filter
    if (state) {
      filter.state = new RegExp(state, "i"); // Case insensitive
    }

    // Add followers range filter
    if (minFollowers || maxFollowers) {
      filter["scrapedData.followers"] = {};
      if (minFollowers)
        filter["scrapedData.followers"].$gte = parseInt(minFollowers);
      if (maxFollowers)
        filter["scrapedData.followers"].$lte = parseInt(maxFollowers);
    }

    // Add engagement rate filter (assuming it's stored as percentage string like "2.5%")
    if (minEngagement || maxEngagement) {
      // We'll need to handle this differently since engagement is stored as string
      // For now, let's assume we can convert it to number
      const engagementConditions = [];
      if (minEngagement) {
        engagementConditions.push({
          $expr: {
            $gte: [
              {
                $toDouble: {
                  $substr: [
                    "$scrapedData.engagementRate",
                    0,
                    {
                      $subtract: [
                        { $strLenCP: "$scrapedData.engagementRate" },
                        1,
                      ],
                    },
                  ],
                },
              },
              parseFloat(minEngagement),
            ],
          },
        });
      }
      if (maxEngagement) {
        engagementConditions.push({
          $expr: {
            $lte: [
              {
                $toDouble: {
                  $substr: [
                    "$scrapedData.engagementRate",
                    0,
                    {
                      $subtract: [
                        { $strLenCP: "$scrapedData.engagementRate" },
                        1,
                      ],
                    },
                  ],
                },
              },
              parseFloat(maxEngagement),
            ],
          },
        });
      }
      if (engagementConditions.length > 0) {
        filter.$and = engagementConditions;
      }
    }

    // Add search filter (searches in instaUsername, brandName, city, niche)
    if (search) {
      filter.$or = [
        { instaUsername: new RegExp(search, "i") },
        { city: new RegExp(search, "i") },
        { niche: new RegExp(search, "i") },
        { state: new RegExp(search, "i") },
      ];
    }

    // Build sort object
    const sort = {};
    switch (sortBy) {
      case "followers":
        sort["scrapedData.followers"] = sortOrder === "asc" ? 1 : -1;
        break;
      case "engagement":
        // For engagement, we'll sort by the numeric value
        sort["scrapedData.engagementRate"] = sortOrder === "asc" ? 1 : -1;
        break;
      case "avgLikes":
        sort["scrapedData.avgLikes"] = sortOrder === "asc" ? 1 : -1;
        break;
      case "avgComments":
        sort["scrapedData.avgComments"] = sortOrder === "asc" ? 1 : -1;
        break;
      case "totalUploads":
        sort["scrapedData.totalUploads"] = sortOrder === "asc" ? 1 : -1;
        break;
      case "postsPerWeek":
        sort["scrapedData.postsPerWeek"] = sortOrder === "asc" ? 1 : -1;
        break;
      case "createdAt":
      default:
        sort.createdAt = sortOrder === "asc" ? 1 : -1;
        break;
    }

    // Calculate pagination
    const pageNumber = Math.max(1, parseInt(page));
    const pageSize = Math.min(50, Math.max(1, parseInt(limit))); // Max 50 items per page
    const skip = (pageNumber - 1) * pageSize;

    // Execute query with pagination
    const creators = await User.find(filter)
      .select("-password -resetToken -resetTokenExpiry") // Exclude sensitive fields
      .sort(sort)
      .skip(skip)
      .limit(pageSize)
      .lean(); // Use lean() for better performance

    // Get total count for pagination info
    const totalCount = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / pageSize);

    // Prepare response
    const response = {
      creators,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalItems: totalCount,
        itemsPerPage: pageSize,
        hasNextPage: pageNumber < totalPages,
        hasPreviousPage: pageNumber > 1,
      },
      filters: {
        city,
        niche,
        state,
        minFollowers,
        maxFollowers,
        minEngagement,
        maxEngagement,
        search,
      },
      sorting: {
        sortBy,
        sortOrder,
      },
    };

    res.status(200).json(response);
  } catch (err) {
    console.error("Get creators error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/profiles/creator/:id - Get single creator profile
router.get("/creator/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const creator = await User.findOne({
      _id: id,
      role: "creator",
      status: "approved",
    }).select("-password -resetToken -resetTokenExpiry");

    if (!creator) {
      return res.status(404).json({ error: "Creator not found" });
    }

    res.status(200).json({ creator });
  } catch (err) {
    console.error("Get creator error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/profiles/filters/options - Get available filter options
router.get("/filters/options", authenticate, async (req, res) => {
  try {
    // Get unique cities, niches, and states for filter dropdowns
    const [cities, niches, states] = await Promise.all([
      User.distinct("city", { role: "creator", status: "approved" }),
      User.distinct("niche", { role: "creator", status: "approved" }),
      User.distinct("state", { role: "creator", status: "approved" }),
    ]);

    // Get follower range
    const followerStats = await User.aggregate([
      {
        $match: {
          role: "creator",
          status: "approved",
          "scrapedData.followers": { $exists: true },
        },
      },
      {
        $group: {
          _id: null,
          minFollowers: { $min: "$scrapedData.followers" },
          maxFollowers: { $max: "$scrapedData.followers" },
        },
      },
    ]);

    res.status(200).json({
      cities: cities.filter(Boolean).sort(),
      niches: niches.filter(Boolean).sort(),
      states: states.filter(Boolean).sort(),
      followerRange: followerStats[0] || { minFollowers: 0, maxFollowers: 0 },
      sortOptions: [
        { value: "createdAt", label: "Recently Joined" },
        { value: "followers", label: "Followers" },
        { value: "engagement", label: "Engagement Rate" },
        { value: "avgLikes", label: "Average Likes" },
        { value: "avgComments", label: "Average Comments" },
        { value: "totalUploads", label: "Total Posts" },
        { value: "postsPerWeek", label: "Posts Per Week" },
      ],
    });
  } catch (err) {
    console.error("Get filter options error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/profiles/stats - Get overall statistics
router.get(
  "/stats",
  authenticate,
  authorizeRoles("brand", "admin"),
  async (req, res) => {
    try {
      const stats = await User.aggregate([
        { $match: { role: "creator", status: "approved" } },
        {
          $group: {
            _id: null,
            totalCreators: { $sum: 1 },
            avgFollowers: { $avg: "$scrapedData.followers" },
            totalFollowers: { $sum: "$scrapedData.followers" },
            avgEngagement: {
              $avg: {
                $toDouble: {
                  $substr: [
                    "$scrapedData.engagementRate",
                    0,
                    {
                      $subtract: [
                        { $strLenCP: "$scrapedData.engagementRate" },
                        1,
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      ]);

      // Get top niches
      const topNiches = await User.aggregate([
        { $match: { role: "creator", status: "approved" } },
        { $group: { _id: "$niche", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]);

      // Get top cities
      const topCities = await User.aggregate([
        { $match: { role: "creator", status: "approved" } },
        { $group: { _id: "$city", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]);

      res.status(200).json({
        overview: stats[0] || {},
        topNiches,
        topCities,
      });
    } catch (err) {
      console.error("Get stats error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// GET /api/profiles/brands - Get brand profiles (for creators to view)
router.get(
  "/brands",
  authenticate,
  authorizeRoles("creator"),
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        niche,
        search,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      // Build filter object
      const filter = {
        role: "brand",
        status: "approved",
      };

      // Add niche filter
      if (niche) {
        filter.niche = new RegExp(niche, "i");
      }

      // Add search filter
      if (search) {
        filter.$or = [
          { brandName: new RegExp(search, "i") },
          { niche: new RegExp(search, "i") },
          { email: new RegExp(search, "i") },
        ];
      }

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === "asc" ? 1 : -1;

      // Calculate pagination
      const pageNumber = Math.max(1, parseInt(page));
      const pageSize = Math.min(50, Math.max(1, parseInt(limit)));
      const skip = (pageNumber - 1) * pageSize;

      // Execute query
      const brands = await User.find(filter)
        .select("-password -resetToken -resetTokenExpiry")
        .sort(sort)
        .skip(skip)
        .limit(pageSize)
        .lean();

      const totalCount = await User.countDocuments(filter);
      const totalPages = Math.ceil(totalCount / pageSize);

      res.status(200).json({
        brands,
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
      console.error("Get brands error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// POST /api/profiles/save/:profileId - Save a profile (Improved version)
router.post("/save/:profileId", authenticate, async (req, res) => {
  try {
    const { profileId } = req.params;
    const { notes, tags } = req.body;
    const userId = req.user._id;

    // Check if the profile exists and is approved
    const profileToSave = await User.findOne({
      _id: profileId,
      status: "approved"
    });

    if (!profileToSave) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Prevent users from saving their own profile
    if (profileId === userId.toString()) {
      return res.status(400).json({ error: "Cannot save your own profile" });
    }

    // Check role compatibility (brands can save creators, creators can save brands)
    const userRole = req.user.role;
    const profileRole = profileToSave.role;

    if (
      (userRole === "brand" && profileRole !== "creator") ||
      (userRole === "creator" && profileRole !== "brand")
    ) {
      return res.status(400).json({ error: "Invalid profile type for your role" });
    }

    // Create saved profile entry
    const savedProfile = new SavedProfile({
      user: userId,
      savedProfile: profileId,
      notes: notes || "",
      tags: tags || []
    });

    await savedProfile.save();

    res.status(200).json({ 
      message: "Profile saved successfully",
      savedProfile: {
        id: savedProfile._id,
        savedAt: savedProfile.savedAt,
        notes: savedProfile.notes,
        tags: savedProfile.tags
      }
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: "Profile already saved" });
    }
    console.error("Save profile error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/profiles/unsave/:profileId - Unsave a profile (Improved version)
router.delete("/unsave/:profileId", authenticate, async (req, res) => {
  try {
    const { profileId } = req.params;
    const userId = req.user._id;

    const result = await SavedProfile.deleteOne({
      user: userId,
      savedProfile: profileId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Profile not found in saved list" });
    }

    res.status(200).json({ message: "Profile unsaved successfully" });
  } catch (err) {
    console.error("Unsave profile error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/profiles/saved - Get user's saved profiles (Improved version)
router.get("/saved", authenticate, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "savedAt",
      sortOrder = "desc",
      tags,
      search
    } = req.query;

    const userId = req.user._id;

    // Calculate pagination
    const pageNumber = Math.max(1, parseInt(page));
    const pageSize = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNumber - 1) * pageSize;

    // Build filter for saved profiles
    const filter = { user: userId };
    
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      filter.tags = { $in: tagArray };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Get saved profiles with populated profile data
    const savedProfiles = await SavedProfile.find(filter)
      .populate({
        path: "savedProfile",
        select: "-password -resetToken -resetTokenExpiry",
        match: { status: "approved" }
      })
      .sort(sort)
      .skip(skip)
      .limit(pageSize)
      .lean();

    // Filter out any saved profiles where the actual profile was deleted or not approved
    const validSavedProfiles = savedProfiles.filter(sp => sp.savedProfile);

    // Add search functionality if needed
    let filteredProfiles = validSavedProfiles;
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filteredProfiles = validSavedProfiles.filter(sp => {
        const profile = sp.savedProfile;
        return (
          (profile.instaUsername && searchRegex.test(profile.instaUsername)) ||
          (profile.brandName && searchRegex.test(profile.brandName)) ||
          (profile.city && searchRegex.test(profile.city)) ||
          (profile.niche && searchRegex.test(profile.niche)) ||
          (sp.notes && searchRegex.test(sp.notes)) ||
          (sp.tags && sp.tags.some(tag => searchRegex.test(tag)))
        );
      });
    }

    // Get total count
    const totalCount = await SavedProfile.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / pageSize);

    res.status(200).json({
      savedProfiles: filteredProfiles,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalItems: totalCount,
        itemsPerPage: pageSize,
        hasNextPage: pageNumber < totalPages,
        hasPreviousPage: pageNumber > 1
      }
    });
  } catch (err) {
    console.error("Get saved profiles error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/profiles/saved/check/:profileId - Check if profile is saved (Improved version)
router.get("/saved/check/:profileId", authenticate, async (req, res) => {
  try {
    const { profileId } = req.params;
    const userId = req.user._id;

    const savedProfile = await SavedProfile.findOne({
      user: userId,
      savedProfile: profileId
    });

    res.status(200).json({ 
      isSaved: !!savedProfile,
      savedData: savedProfile ? {
        savedAt: savedProfile.savedAt,
        notes: savedProfile.notes,
        tags: savedProfile.tags
      } : null
    });
  } catch (err) {
    console.error("Check saved profile error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/profiles/saved/:profileId - Update saved profile notes/tags
router.patch("/saved/:profileId", authenticate, async (req, res) => {
  try {
    const { profileId } = req.params;
    const { notes, tags } = req.body;
    const userId = req.user._id;

    const savedProfile = await SavedProfile.findOneAndUpdate(
      { user: userId, savedProfile: profileId },
      { 
        notes: notes || "",
        tags: tags || [],
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!savedProfile) {
      return res.status(404).json({ error: "Saved profile not found" });
    }

    res.status(200).json({ 
      message: "Saved profile updated successfully",
      savedProfile: {
        notes: savedProfile.notes,
        tags: savedProfile.tags,
        savedAt: savedProfile.savedAt,
        updatedAt: savedProfile.updatedAt
      }
    });
  } catch (err) {
    console.error("Update saved profile error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/profiles/saved/count - Get count of saved profiles (Improved version)
router.get("/saved/count", authenticate, async (req, res) => {
  try {
    const userId = req.user._id;

    const count = await SavedProfile.countDocuments({ user: userId });

    res.status(200).json({ count });
  } catch (err) {
    console.error("Get saved count error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/profiles/saved/tags - Get all tags used by user
router.get("/saved/tags", authenticate, async (req, res) => {
  try {
    const userId = req.user._id;

    const tags = await SavedProfile.distinct("tags", { user: userId });

    res.status(200).json({ tags: tags.filter(Boolean) });
  } catch (err) {
    console.error("Get saved tags error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/profiles/saved/analytics - Get analytics for saved profiles (for brands)
router.get("/saved/analytics", authenticate, authorizeRoles("brand"), async (req, res) => {
  try {
    const userId = req.user._id;

    const analytics = await SavedProfile.aggregate([
      { $match: { user: userId } },
      {
        $lookup: {
          from: "users",
          localField: "savedProfile",
          foreignField: "_id",
          as: "profile"
        }
      },
      { $unwind: "$profile" },
      {
        $group: {
          _id: null,
          totalSaved: { $sum: 1 },
          avgFollowers: { $avg: "$profile.scrapedData.followers" },
          topNiches: { $push: "$profile.niche" },
          topCities: { $push: "$profile.city" },
          savesThisMonth: {
            $sum: {
              $cond: {
                if: { $gte: ["$savedAt", new Date(new Date().getFullYear(), new Date().getMonth(), 1)] },
                then: 1,
                else: 0
              }
            }
          }
        }
      }
    ]);

    const result = analytics[0] || {
      totalSaved: 0,
      avgFollowers: 0,
      topNiches: [],
      topCities: [],
      savesThisMonth: 0
    };

    // Process top niches and cities
    const nicheCount = {};
    const cityCount = {};

    result.topNiches.forEach(niche => {
      nicheCount[niche] = (nicheCount[niche] || 0) + 1;
    });

    result.topCities.forEach(city => {
      cityCount[city] = (cityCount[city] || 0) + 1;
    });

    result.topNiches = Object.entries(nicheCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([niche, count]) => ({ niche, count }));

    result.topCities = Object.entries(cityCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([city, count]) => ({ city, count }));

    res.status(200).json({ analytics: result });
  } catch (err) {
    console.error("Get saved analytics error:", err);
    res.status(500).json({ error: "Server error" });
  }
});
module.exports = router;
