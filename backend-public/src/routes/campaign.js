// backend/routes/campaign.js
const express = require("express");
const router = express.Router();
const Campaign = require("../models/Campaign");
const Application = require("../models/Application");
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

    // Get application counts for each campaign
    const campaignsWithStats = await Promise.all(
      campaigns.map(async (campaign) => {
        const applicationStats = await Application.aggregate([
          { $match: { campaign: campaign._id } },
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 }
            }
          }
        ]);

        const stats = {
          total: 0,
          pending: 0,
          accepted: 0,
          rejected: 0,
          withdrawn: 0
        };

        applicationStats.forEach(stat => {
          stats[stat._id] = stat.count;
          stats.total += stat.count;
        });

        return {
          ...campaign.toObject(),
          applicationStats: stats
        };
      })
    );

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
    const campaignsWithApplicationStatus = await Promise.all(
      campaigns.map(async (campaign) => {
        const existingApplication = await Application.findOne({
          campaign: campaign._id,
          creator: creatorId
        });

        return {
          ...campaign.toObject(),
          hasApplied: !!existingApplication,
          applicationStatus: existingApplication?.status || null
        };
      })
    );

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

    // Check permissions
    if (userRole === "brand" && campaign.brand._id.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Access denied" });
    }

    let responseData = campaign.toObject();

    // Add application status for creators
    if (userRole === "creator") {
      const existingApplication = await Application.findOne({
        campaign: id,
        creator: userId
      });

      responseData.hasApplied = !!existingApplication;
      responseData.applicationStatus = existingApplication?.status || null;
      responseData.applicationId = existingApplication?._id || null;
    }

    // Add application stats for brands
    if (userRole === "brand") {
      const applicationStats = await Application.aggregate([
        { $match: { campaign: campaign._id } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 }
          }
        }
      ]);

      const stats = {
        total: 0,
        pending: 0,
        accepted: 0,
        rejected: 0,
        withdrawn: 0
      };

      applicationStats.forEach(stat => {
        stats[stat._id] = stat.count;
        stats.total += stat.count;
      });

      responseData.applicationStats = stats;
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

    // Check if there are any accepted applications
    const acceptedApplications = await Application.countDocuments({
      campaign: id,
      status: "accepted"
    });

    if (acceptedApplications > 0) {
      return res.status(400).json({
        error: "Cannot delete campaign with accepted applications"
      });
    }

    // Delete all applications for this campaign
    await Application.deleteMany({ campaign: id });

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
    const { message, proposedDeliverables, proposedTimeline } = req.body;

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
    const existingApplication = await Application.findOne({
      campaign: id,
      creator: creatorId
    });

    if (existingApplication) {
      return res.status(400).json({ 
        error: "You have already applied to this campaign",
        applicationStatus: existingApplication.status
      });
    }

    // Create new application
    const newApplication = new Application({
      campaign: id,
      creator: creatorId,
      message: message || "",
      proposedDeliverables: proposedDeliverables || "",
      proposedTimeline: proposedTimeline || ""
    });

    await newApplication.save();

    // Populate the application with campaign and creator details
    await newApplication.populate([
      { path: "campaign", select: "name brand" },
      { path: "creator", select: "instaUsername email city niche" }
    ]);

    res.status(201).json({
      message: "Application submitted successfully",
      application: newApplication
    });
  } catch (err) {
    console.error("Apply to campaign error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/campaigns/:id/applications - Get applications for a campaign (for brands)
router.get("/:id/applications", authenticate, authorizeRoles("brand"), async (req, res) => {
  try {
    const { id } = req.params;
    const brandId = req.user._id;
    const { status, page = 1, limit = 10 } = req.query;

    // Verify campaign belongs to the brand
    const campaign = await Campaign.findOne({ _id: id, brand: brandId });
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    // Build filter
    const filter = { campaign: id };
    if (status && ["pending", "accepted", "rejected", "withdrawn"].includes(status)) {
      filter.status = status;
    }

    // Calculate pagination
    const pageNumber = Math.max(1, parseInt(page));
    const pageSize = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNumber - 1) * pageSize;

    const applications = await Application.find(filter)
      .populate("creator", "instaUsername email city niche scrapedData")
      .populate("campaign", "name")
      .sort({ appliedAt: -1 })
      .skip(skip)
      .limit(pageSize);

    const totalCount = await Application.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / pageSize);

    res.status(200).json({
      applications,
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
    console.error("Get campaign applications error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/campaigns/:campaignId/applications/:applicationId - Update application status (for brands)
router.patch("/:campaignId/applications/:applicationId", authenticate, authorizeRoles("brand"), async (req, res) => {
  try {
    const { campaignId, applicationId } = req.params;
    const brandId = req.user._id;
    const { status, message } = req.body;

    if (!["accepted", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    // Verify campaign belongs to the brand
    const campaign = await Campaign.findOne({ _id: campaignId, brand: brandId });
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    // Find and update the application
    const application = await Application.findOne({
      _id: applicationId,
      campaign: campaignId
    });

    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    if (application.status !== "pending") {
      return res.status(400).json({ error: "Application has already been processed" });
    }

    application.status = status;
    application.brandResponse = {
      message: message || "",
      respondedAt: new Date(),
      respondedBy: brandId
    };

    await application.save();

    // Populate for response
    await application.populate([
      { path: "creator", select: "instaUsername email" },
      { path: "campaign", select: "name" }
    ]);

    res.status(200).json({
      message: `Application ${status} successfully`,
      application
    });
  } catch (err) {
    console.error("Update application status error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/campaigns/applications/my - Get creator's applications
router.get("/applications/my", authenticate, authorizeRoles("creator"), async (req, res) => {
  try {
    const creatorId = req.user._id;
    const { status, page = 1, limit = 10 } = req.query;

    // Build filter
    const filter = { creator: creatorId };
    if (status && ["pending", "accepted", "rejected", "withdrawn"].includes(status)) {
      filter.status = status;
    }

    // Calculate pagination
    const pageNumber = Math.max(1, parseInt(page));
    const pageSize = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNumber - 1) * pageSize;

    const applications = await Application.find(filter)
      .populate({
        path: "campaign",
        select: "name description rewardType budgetRange startDate endDate status",
        populate: {
          path: "brand",
          select: "brandName email"
        }
      })
      .sort({ appliedAt: -1 })
      .skip(skip)
      .limit(pageSize);

    const totalCount = await Application.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / pageSize);

    res.status(200).json({
      applications,
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

// DELETE /api/campaigns/applications/:applicationId - Withdraw application (for creators)
router.delete("/applications/:applicationId", authenticate, authorizeRoles("creator"), async (req, res) => {
  try {
    const { applicationId } = req.params;
    const creatorId = req.user._id;

    const application = await Application.findOne({
      _id: applicationId,
      creator: creatorId
    });

    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    if (application.status === "accepted") {
      return res.status(400).json({ error: "Cannot withdraw accepted application" });
    }

    application.status = "withdrawn";
    await application.save();

    res.status(200).json({ message: "Application withdrawn successfully" });
  } catch (err) {
    console.error("Withdraw application error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;