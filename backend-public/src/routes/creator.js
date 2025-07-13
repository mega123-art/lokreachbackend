const express = require("express");
const router = express.Router();
const User = require("../models/User");
const CreatorProfile = require("../models/CreatorProfile");
const { authenticate, authorizeRoles } = require("../middleware/auth");

// ✅ Moved this route first — more specific route should come before "/"
router.get("/all", authenticate, authorizeRoles("brand"), async (req, res) => {
  try {
    const profiles = await CreatorProfile.find()
      .populate("user", "username contactEmail")
      .sort({ createdAt: -1 });

    res.status(200).json({ creators: profiles });
  } catch (err) {
    console.error("Fetch all creators error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ General route comes after more specific ones
// GET /api/creators?city=CityName
router.get("/", authenticate, authorizeRoles("brand"), async (req, res) => {
  try {
    const city = req.query.city;
    if (!city) return res.status(400).json({ error: "City is required" });

    const profiles = await CreatorProfile.find({ location: city })
      .populate("user", "username contactEmail")
      .exec();

    res.status(200).json({ creators: profiles });
  } catch (err) {
    console.error("Fetch creators error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/creators/profile/:id
router.get("/profile/:id", async (req, res) => {
  try {
    const creatorId = req.params.id;

    const user = await User.findOne({ _id: creatorId, role: "creator" });
    if (!user) return res.status(404).json({ error: "Creator not found" });

    const profile = await CreatorProfile.findOne({ user: creatorId });

    res.status(200).json({
      contactEmail: user.contactEmail,
      profile,
    });
  } catch (err) {
    console.error("Get creator profile error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
