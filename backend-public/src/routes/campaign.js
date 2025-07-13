// backend/routes/campaign.js
const express = require("express");
const router = express.Router();
const Campaign = require("../models/Campaign");

const User = require("../models/User");
const { authenticate, authorizeRoles } = require("../middleware/auth");
const upload = require("../middleware/upload");

// POST /api/campaigns
router.post("/", authenticate, authorizeRoles("brand"), upload.array("images", 5), async (req, res) => {
  try {
    const {
      brandId,
      name,
      niche,
      city,
      description,
      startDate,
      endDate,
      rewardType,
      budgetRange,
    } = req.body;

    const brand = await User.findById(brandId);
    if (!brand || brand.role !== "brand") {
      return res.status(400).json({ error: "Invalid brand ID" });
    }
    
    const imagePaths = req.files.map((file) => `/uploads/${file.filename}`);
    
    // Parse budgetRange if it's a string
    let parsedBudgetRange;
    if (rewardType === "money" && budgetRange) {
      try {
        parsedBudgetRange = typeof budgetRange === 'string' ? JSON.parse(budgetRange) : budgetRange;
      } catch (e) {
        parsedBudgetRange = undefined;
      }
    }

    const newCampaign = new Campaign({
      brand: brandId,
      name,
      niche,
      city,
      description,
      startDate,
      endDate,
      rewardType,
      budgetRange: parsedBudgetRange,
      images: imagePaths,
    });

    await newCampaign.save();
    res.status(201).json({ message: "Campaign created", campaign: newCampaign });
  } catch (err) {
    console.error("Create campaign error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/campaigns/all - Get all campaigns (for creators)
router.get("/all", authenticate, authorizeRoles("creator"), async (req, res) => {
  try {
    const campaigns = await Campaign.find()
      .populate("brand", "email")
      .sort({ createdAt: -1 });

    res.status(200).json({ campaigns });
  } catch (err) {
    console.error("Get all campaigns error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/campaigns/brand/:brandId - Get campaigns by brand
router.get("/brand/:brandId", authenticate, authorizeRoles("brand"), async (req, res) => {
  try {
    const { brandId } = req.params;
    
    // Ensure the authenticated user can only access their own campaigns
    if (req.user._id.toString() !== brandId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const campaigns = await Campaign.find({ brand: brandId })
      .populate("starredCreators", "username contactEmail")
      .sort({ createdAt: -1 });

    res.status(200).json({ campaigns });
  } catch (err) {
    console.error("Get brand campaigns error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/campaigns/:id/star/:creatorId
router.patch("/:id/star/:creatorId", authenticate, authorizeRoles("brand"), async (req, res) => {
  try {
    const { id, creatorId } = req.params;

    const campaign = await Campaign.findById(id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    // Ensure the brand owns this campaign
    if (campaign.brand.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Check if creator exists
    const creator = await User.findById(creatorId);
    if (!creator || creator.role !== "creator") {
      return res.status(404).json({ error: "Creator not found" });
    }

    if (!campaign.starredCreators.includes(creatorId)) {
      campaign.starredCreators.push(creatorId);
      await campaign.save();
    }

    res.status(200).json({ message: "Creator starred" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to star creator" });
  }
});

// GET /api/campaigns/:campaignId/starred
router.get("/:id/starred", authenticate, authorizeRoles("brand"), async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id).populate({
      path: "starredCreators",
      select: "username contactEmail",
    });

    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    // Ensure the brand owns this campaign
    if (campaign.brand.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Access denied" });
    }

    const creatorIds = campaign.starredCreators.map((c) => c._id);
    const profiles = await CreatorProfile.find({
      user: { $in: creatorIds },
    }).populate("user", "username contactEmail");

    res.status(200).json({ starred: profiles });
  } catch (err) {
    console.error("Error fetching starred creators:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;