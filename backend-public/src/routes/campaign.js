// backend/routes/campaign.js
const express = require("express");
const router = express.Router();
const Campaign = require("../models/Campaign");
const User = require("../models/User");
const { authenticate, authorizeRoles } = require("../middleware/auth");
const upload = require("../middleware/upload");

// POST /api/campaigns - Create a new campaign
router.post("/", authenticate, authorizeRoles("brand"), upload.array("images", 5), async (req, res) => {
  try {
    const {
      name,
      niche,
      city,
      description,
      startDate,
      endDate,
      rewardType,
      budgetRange,
    } = req.body;

    // Use the authenticated user's ID as the brand
    const brandId = req.user._id;
    
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
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      rewardType,
      budgetRange: parsedBudgetRange,
      images: imagePaths,
      appliedCreators: [], // Initialize empty array
    });

    await newCampaign.save();
    
    // Populate brand info for response
    await newCampaign.populate("brand", "brandName email");
    
    res.status(201).json({ 
      message: "Campaign created successfully", 
      campaign: newCampaign 
    });
  } catch (err) {
    console.error("Create campaign error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/campaigns/my - Get campaigns for the authenticated brand
router.get("/my", authenticate, authorizeRoles("brand"), async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const brandId = req.user._id;

    // Build filter
    const filter = { brand: brandId };
    if (status && ["draft", "active", "expired", "cancelled"].includes(status)) {
      filter.status = status;
    }

    // Calculate pagination
    const pageNumber = Math.max(1, parseInt(page));
    const pageSize = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNumber - 1) * pageSize;

    const campaigns = await Campaign.find(filter)
      .populate("brand", "brandName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);

    // Add application count to each campaign
    const campaignsWithStats = campaigns.map(campaign => ({
      ...campaign.toObject(),
      applicationCount: campaign.appliedCreators.length
    }));

    const totalCount = await Campaign.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / pageSize);

    res.status(200).json({
      campaigns: campaignsWithStats,
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
    console.error("Get brand campaigns error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/campaigns/all - Get all active campaigns (for creators)
router.get("/all", authenticate, authorizeRoles("creator"), async (req, res) => {
  try {
    const { 
      niche, 
      city, 
      rewardType, 
      page = 1, 
      limit = 10,
      search 
    } = req.query;

    // Build filter for active campaigns only
    const filter = { 
      status: "active",
      // Only show campaigns that haven't expired
      $or: [
        { endDate: { $exists: false } },
        { endDate: { $gte: new Date() } }
      ]
    };

    if (niche) {
      filter.niche = new RegExp(niche, "i");
    }

    if (city) {
      filter.city = new RegExp(city, "i");
    }

    if (rewardType && ["barter", "money"].includes(rewardType)) {
      filter.rewardType = rewardType;
    }

    if (search) {
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { name: new RegExp(search, "i") },
            { description: new RegExp(search, "i") },
            { niche: new RegExp(search, "i") },
            { city: new RegExp(search, "i") }
          ]
        }
      ];
    }

    // Calculate pagination
    const pageNumber = Math.max(1, parseInt(page));
    const pageSize = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNumber - 1) * pageSize;

    const campaigns = await Campaign.find(filter)
      .populate("brand", "brandName email niche")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);

    // Check if creator has already applied to each campaign
    const creatorId = req.user._id;
    const campaignsWithApplicationStatus = campaigns.map(campaign => {
      const hasApplied = campaign.appliedCreators.some(
        app => app.creator.toString() === creatorId.toString()
      );

      return {
        ...campaign.toObject(),
        hasApplied,
        applicationCount: campaign.appliedCreators.length
      };
    });

    const totalCount = await Campaign.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / pageSize);

    res.status(200).json({
      campaigns: campaignsWithApplicationStatus,
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
    console.error("Get all campaigns error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/campaigns/:id - Get single campaign details
router.get("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    const campaign = await Campaign.findById(id)
      .populate("brand", "brandName email niche contactNumber");

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    // Check permissions for brand
    if (userRole === "brand" && campaign.brand._id.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Access denied" });
    }

    let responseData = campaign.toObject();

    // Add application status for creators
    if (userRole === "creator") {
      const hasApplied = campaign.appliedCreators.some(
        app => app.creator.toString() === userId.toString()
      );

      responseData.hasApplied = hasApplied;
      responseData.applicationCount = campaign.appliedCreators.length;
    }

    // Add application count for brands
    if (userRole === "brand") {
      responseData.applicationCount = campaign.appliedCreators.length;
    }

    res.status(200).json({ campaign: responseData });
  } catch (err) {
    console.error("Get campaign error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/campaigns/:id - Update campaign
router.put("/:id", authenticate, authorizeRoles("brand"), async (req, res) => {
  try {
    const { id } = req.params;
    const brandId = req.user._id;
    const updateData = req.body;

    const campaign = await Campaign.findOne({ _id: id, brand: brandId });
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    // Parse budgetRange if provided
    if (updateData.budgetRange && typeof updateData.budgetRange === 'string') {
      try {
        updateData.budgetRange = JSON.parse(updateData.budgetRange);
      } catch (e) {
        delete updateData.budgetRange;
      }
    }

    // Parse dates if provided
    if (updateData.startDate) {
      updateData.startDate = new Date(updateData.startDate);
    }
    if (updateData.endDate) {
      updateData.endDate = new Date(updateData.endDate);
    }

    const updatedCampaign = await Campaign.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate("brand", "brandName email");

    res.status(200).json({
      message: "Campaign updated successfully",
      campaign: updatedCampaign
    });
  } catch (err) {
    console.error("Update campaign error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/campaigns/:id - Delete campaign
router.delete("/:id", authenticate, authorizeRoles("brand"), async (req, res) => {
  try {
    const { id } = req.params;
    const brandId = req.user._id;

    const campaign = await Campaign.findOne({ _id: id, brand: brandId });
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    // Delete the campaign
    await Campaign.findByIdAndDelete(id);

    res.status(200).json({ message: "Campaign deleted successfully" });
  } catch (err) {
    console.error("Delete campaign error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/campaigns/:id/apply - Apply to a campaign (for creators)
router.post("/:id/apply", authenticate, authorizeRoles("creator"), async (req, res) => {
  try {
    const { id } = req.params;
    const creatorId = req.user._id;

    // Check if campaign exists and is active
    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    if (campaign.status !== "active") {
      return res.status(400).json({ error: "Campaign is not active" });
    }

    // Check if campaign has expired
    if (campaign.endDate && new Date() > campaign.endDate) {
      return res.status(400).json({ error: "Campaign has expired" });
    }

    // Check if creator has already applied
    const hasApplied = campaign.appliedCreators.some(
      app => app.creator.toString() === creatorId.toString()
    );

    if (hasApplied) {
      return res.status(400).json({ 
        error: "You have already applied to this campaign"
      });
    }

    // Add creator to applied list
    campaign.appliedCreators.push({
      creator: creatorId,
      appliedAt: new Date()
    });

    await campaign.save();

    res.status(200).json({
      message: "Applied to campaign successfully",
      applicationCount: campaign.appliedCreators.length
    });
  } catch (err) {
    console.error("Apply to campaign error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/campaigns/:id/applicants - Get applicants for a campaign (for brands)
router.get("/:id/applicants", authenticate, authorizeRoles("brand"), async (req, res) => {
  try {
    const { id } = req.params;
    const brandId = req.user._id;
    const { page = 1, limit = 10 } = req.query;

    // Verify campaign belongs to the brand
    const campaign = await Campaign.findOne({ _id: id, brand: brandId });
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    // Calculate pagination
    const pageNumber = Math.max(1, parseInt(page));
    const pageSize = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNumber - 1) * pageSize;

    // Get campaign with populated applicants
    const campaignWithApplicants = await Campaign.findById(id)
      .populate({
        path: "appliedCreators.creator",
        select: "instaUsername email city niche scrapedData state contactNumber"
      })
      .lean();

    if (!campaignWithApplicants) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    // Apply pagination to applicants
    const totalApplicants = campaignWithApplicants.appliedCreators.length;
    const paginatedApplicants = campaignWithApplicants.appliedCreators
      .sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt))
      .slice(skip, skip + pageSize);

    const totalPages = Math.ceil(totalApplicants / pageSize);

    res.status(200).json({
      campaign: {
        id: campaignWithApplicants._id,
        name: campaignWithApplicants.name,
        description: campaignWithApplicants.description
      },
      applicants: paginatedApplicants,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalItems: totalApplicants,
        itemsPerPage: pageSize,
        hasNextPage: pageNumber < totalPages,
        hasPreviousPage: pageNumber > 1
      }
    });
  } catch (err) {
    console.error("Get campaign applicants error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/campaigns/:id/unapply - Remove application (for creators)
router.delete("/:id/unapply", authenticate, authorizeRoles("creator"), async (req, res) => {
  try {
    const { id } = req.params;
    const creatorId = req.user._id;

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    // Check if creator has applied
    const applicationIndex = campaign.appliedCreators.findIndex(
      app => app.creator.toString() === creatorId.toString()
    );

    if (applicationIndex === -1) {
      return res.status(400).json({ error: "You have not applied to this campaign" });
    }

    // Remove the application
    campaign.appliedCreators.splice(applicationIndex, 1);
    await campaign.save();

    res.status(200).json({ 
      message: "Application removed successfully",
      applicationCount: campaign.appliedCreators.length
    });
  } catch (err) {
    console.error("Remove application error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/campaigns/my/applications - Get campaigns creator has applied to
router.get("/my/applications", authenticate, authorizeRoles("creator"), async (req, res) => {
  try {
    const creatorId = req.user._id;
    const { page = 1, limit = 10 } = req.query;

    // Calculate pagination
    const pageNumber = Math.max(1, parseInt(page));
    const pageSize = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNumber - 1) * pageSize;

    // Find campaigns where creator has applied
    const campaigns = await Campaign.find({
      "appliedCreators.creator": creatorId
    })
    .populate("brand", "brandName email")
    .sort({ "appliedCreators.appliedAt": -1 })
    .skip(skip)
    .limit(pageSize);

    // Add application date to each campaign
    const campaignsWithApplicationDate = campaigns.map(campaign => {
      const application = campaign.appliedCreators.find(
        app => app.creator.toString() === creatorId.toString()
      );
      
      return {
        ...campaign.toObject(),
        appliedAt: application.appliedAt,
        applicationCount: campaign.appliedCreators.length
      };
    });

    const totalCount = await Campaign.countDocuments({
      "appliedCreators.creator": creatorId
    });
    const totalPages = Math.ceil(totalCount / pageSize);

    res.status(200).json({
      campaigns: campaignsWithApplicationDate,
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
    console.error("Get creator applications error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;