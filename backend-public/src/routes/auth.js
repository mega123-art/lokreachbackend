// // backend/routes/auth.js
// const express = require("express");
// const bcrypt = require("bcryptjs");
// const jwt = require("jsonwebtoken");
// const crypto = require("crypto");
// const User = require("../models/User");
// const { ApifyClient } = require("apify-client");

// const router = express.Router();

// // Middleware to log route access
// router.use((req, res, next) => {
//   console.log(`🔐 Auth route: ${req.method} ${req.path}`);
//   next();
// });

// const apifyClient = new ApifyClient({
//   token: `${process.env.APIFY_API_TOKEN}`,
// });

// // Function to scrape Instagram post comments
// async function scrapeInstagramComments(postUrl) {
//   try {
//     console.log(`🔍 Starting Instagram comment scrape for post: ${postUrl}`);

//     const input = {
//       directUrls: [postUrl],
//       resultsLimit: 100, // Increase limit to get more comments
//     };

//     const run = await apifyClient.actor("SbK00X0JYCPblD2wp").call(input);
//     const { items } = await apifyClient
//       .dataset(run.defaultDatasetId)
//       .listItems();

//     if (items.length === 0) {
//       console.log("❌ No data found for the Instagram post");
//       return { success: false, comments: [], error: "Post not found or no comments" };
//     }

//     const postData = items[0];
//     const comments = postData.comments || [];

//     console.log(`✅ Successfully scraped ${comments.length} comments`);
//     return { success: true, comments, postData };
//   } catch (error) {
//     console.error("❌ Error during Instagram comment scrape:", error.message);
//     return { success: false, comments: [], error: error.message };
//   }
// }

// // Function to verify if user commented with product name
// async function verifyUserComment(instaUsername, postUrl, requiredProductName) {
//   try {
//     console.log(`🔍 Verifying comment by @${instaUsername} for product: ${requiredProductName}`);

//     const scrapeResult = await scrapeInstagramComments(postUrl);
    
//     if (!scrapeResult.success) {
//       return {
//         verified: false,
//         error: scrapeResult.error,
//         message: "Failed to scrape comments from the post"
//       };
//     }

//     const { comments } = scrapeResult;
    
//     // Clean the username (remove @ if present)
//     const cleanUsername = instaUsername.replace(/^@/, "").toLowerCase().trim();
//     const productNameLower = requiredProductName.toLowerCase().trim();

//     // Find comments by the user
//     const userComments = comments.filter(comment => {
//       const commentUsername = comment.ownerUsername?.toLowerCase().trim();
//       return commentUsername === cleanUsername;
//     });

//     if (userComments.length === 0) {
//       return {
//         verified: false,
//         message: `No comments found by @${instaUsername} on this post`,
//         totalComments: comments.length
//       };
//     }

//     // Check if any of the user's comments contain the product name
//     const verifiedComment = userComments.find(comment => {
//       const commentText = comment.text?.toLowerCase().trim() || "";
//       return commentText.includes(productNameLower);
//     });

//     if (verifiedComment) {
//       console.log(`✅ Verification successful! Found comment: "${verifiedComment.text}"`);
//       return {
//         verified: true,
//         message: "Comment verification successful",
//         comment: verifiedComment.text,
//         commentedAt: verifiedComment.timestamp,
//         userComments: userComments.length,
//         totalComments: comments.length
//       };
//     } else {
//       return {
//         verified: false,
//         message: `@${instaUsername} commented on the post but didn't mention "${requiredProductName}"`,
//         userComments: userComments.map(c => c.text),
//         totalComments: comments.length
//       };
//     }
//   } catch (error) {
//     console.error("❌ Error during comment verification:", error.message);
//     return {
//       verified: false,
//       error: error.message,
//       message: "Error occurred during comment verification"
//     };
//   }
// }
// async function scrapeInstagramData(instaUsername) {
//   try {
//     console.log(`🔍 Starting Instagram scrape for: ${instaUsername}`);

//     // Clean the username (remove @ if present)
//     const cleanUsername = instaUsername.replace(/^@/, "").toLowerCase().trim();

//     const input = {
//       usernames: [cleanUsername],
//     };

//     const run = await apifyClient.actor("dSCLg0C3YEZ83HzYX").call(input);
//     const { items } = await apifyClient
//       .dataset(run.defaultDatasetId)
//       .listItems();

//     if (items.length === 0) {
//       console.log("❌ Instagram username not found:", cleanUsername);
//       return { exists: false, data: null };
//     }

//     const profile = items[0];
//     const followers = Number(profile.followersCount) || 0;
//     const totalUploads = Number(profile.postsCount) || 0;
//     const profilePicHD = profile.profilePicUrlHD || "";
//     const posts = profile.latestPosts || [];

//     let totalLikes = 0;
//     let totalComments = 0;
//     let totalEngagement = 0;
//     let postDates = [];

//     posts.forEach((post) => {
//       const likes = Number(post.likesCount) || 0;
//       const comments = Number(post.commentsCount) || 0;
//       const timestamp = post.timestamp ? new Date(post.timestamp) : null;

//       totalLikes += likes;
//       totalComments += comments;
//       if (timestamp) postDates.push(timestamp);

//       if (followers > 0) {
//         const engagement = ((likes + comments) / followers) * 100;
//         totalEngagement += engagement;
//       }
//     });

//     const postCount = posts.length;
//     const avgLikes = postCount ? Math.round(totalLikes / postCount) : 0;
//     const avgComments = postCount ? Math.round(totalComments / postCount) : 0;
//     const engagementRate = postCount
//       ? (totalEngagement / postCount).toFixed(2)
//       : "0.00";

//     let postsPerWeek = 0;
//     if (postDates.length >= 2) {
//       postDates.sort((a, b) => b - a);
//       const durationWeeks =
//         (postDates[0] - postDates[postDates.length - 1]) /
//         (1000 * 60 * 60 * 24 * 7);
//       postsPerWeek =
//         durationWeeks > 0
//           ? Number((postCount / durationWeeks).toFixed(2))
//           : postCount;
//     }

//     const topPostLinks = posts.slice(0, 3).map((p) => p.displayUrl || "");

//     const scrapedData = {
//       followers,
//       totalUploads,
//       avgLikes,
//       avgComments,
//       postsPerWeek,
//       engagementRate,
//       profileHD: profilePicHD,
//       post1: topPostLinks[0] || "",
//       post2: topPostLinks[1] || "",
//       post3: topPostLinks[2] || "",
//     };

//     console.log("✅ Instagram scrape completed successfully");
//     return { exists: true, data: scrapedData };
//   } catch (error) {
//     console.error("❌ Error during Instagram scrape:", error.message);
//     return { exists: false, data: null, error: error.message };
//   }
// }
// // POST /signup
// router.post("/signup", async (req, res) => {
//   try {
//     console.log("=== SIGNUP REQUEST START ===");

//     const {
//       email,
//       password,
//       role,
//       // Brand fields
//       brandName,
//       contactNumber,
//       niche,
//       businessWebsite, // optional
//       instaLink, // optional
//       // Creator fields
//       state,
//       city,
//       instaUsername,
//       // Comment verification fields (for creators)
//       verificationPostUrl,
//       productName,
//     } = req.body;

//     // === Basic validation ===
//     if (!email || !password || !role) {
//       return res.status(400).json({
//         error: "Email, password, and role are required",
//       });
//     }

//     if (password.length < 6) {
//       return res.status(400).json({
//         error: "Password must be at least 6 characters long",
//       });
//     }

//     if (!["creator", "brand", "admin"].includes(role)) {
//       return res.status(400).json({
//         error: "Invalid role specified. Must be 'creator', 'brand', or 'admin'",
//       });
//     }

//     // === Role-specific validation ===
//     if (role === "brand") {
//       if (!brandName || !contactNumber || !niche) {
//         return res.status(400).json({
//           error: "Missing required fields for brand",
//           required: ["brandName", "contactNumber", "niche"],
//         });
//       }
//     }

//     if (role === "creator") {
//       if (!state || !city || !contactNumber || !instaUsername || !niche) {
//         return res.status(400).json({
//           error: "Missing required fields for creator",
//           required: [
//             "state",
//             "city",
//             "contactNumber",
//             "instaUsername",
//             "niche",
//           ],
//         });
//       }

//       // Comment verification validation for creators
//       if (!verificationPostUrl || !productName) {
//         return res.status(400).json({
//           error: "Comment verification is required for creators",
//           required: ["verificationPostUrl", "productName"],
//           message: "Please provide the Instagram post URL and product name for verification"
//         });
//       }

//       // Validate Instagram post URL format
//       const instagramPostRegex = /^https:\/\/(www\.)?instagram\.com\/(p|reel)\/[A-Za-z0-9_-]+/;
//       if (!instagramPostRegex.test(verificationPostUrl)) {
//         return res.status(400).json({
//           error: "Invalid Instagram post URL format",
//           message: "Please provide a valid Instagram post or reel URL"
//         });
//       }
//       // Instagram username validation
//       const normalizedInstaUsername = instaUsername.toLowerCase().trim();
//       if (!/^[a-zA-Z0-9_.]+$/.test(normalizedInstaUsername)) {
//         return res.status(400).json({
//           error:
//             "Instagram username can only contain letters, numbers, dots, and underscores",
//         });
//       }

//       if (
//         normalizedInstaUsername.length < 1 ||
//         normalizedInstaUsername.length > 30
//       ) {
//         return res.status(400).json({
//           error: "Instagram username must be between 1 and 30 characters",
//         });
//       }

//       // Check Instagram username uniqueness
//       const instaUsernameTaken = await User.findOne({
//         instaUsername: normalizedInstaUsername,
//       });
//       if (instaUsernameTaken) {
//         return res.status(409).json({
//           error: "Instagram username already registered",
//           field: "instaUsername",
//         });
//       }
//     }

//     // === Normalize inputs ===
//     const normalizedEmail = email.toLowerCase().trim();
//     const normalizedContactNumber = contactNumber?.trim();
//     const normalizedInstaUsername = instaUsername?.toLowerCase().trim();
//     const normalizedInstaLink = instaLink?.toLowerCase().trim();
//     const normalizedBusinessWebsite = businessWebsite?.toLowerCase().trim();

//     // === Check email uniqueness ===
//     const existingUser = await User.findOne({ email: normalizedEmail });
//     if (existingUser) {
//       return res.status(409).json({
//         error: "Email already in use",
//         field: "email",
//       });
//     }

//     // === Check contact number uniqueness ===
//     if (normalizedContactNumber) {
//       const contactNumberTaken = await User.findOne({
//         contactNumber: normalizedContactNumber,
//       });
//       if (contactNumberTaken) {
//         return res.status(409).json({
//           error: "Contact number already in use",
//           field: "contactNumber",
//         });
//       }
//     }

//     // === Comment verification for creators ===
//     let commentVerificationResult = null;
//     if (role === "creator" && normalizedInstaUsername && verificationPostUrl && productName) {
//       console.log("🔍 Starting comment verification process...");
      
//       commentVerificationResult = await verifyUserComment(
//         normalizedInstaUsername,
//         verificationPostUrl,
//         productName.trim()
//       );

//       if (!commentVerificationResult.verified) {
//         return res.status(400).json({
//           error: "Comment verification failed",
//           field: "commentVerification",
//           details: commentVerificationResult.message,
//           verificationData: {
//             userComments: commentVerificationResult.userComments || [],
//             totalComments: commentVerificationResult.totalComments || 0,
//             requiredProductName: productName.trim()
//           },
//           instructions: `Please comment "${productName.trim()}" on the Instagram post and try again`
//         });
//       }

//       console.log("✅ Comment verification successful!");
//     }
//     // === Hash password ===
//     const hashedPassword = await bcrypt.hash(password, 12);

//     // === Scrape Instagram data for creators and validate username ===
//     let scrapedData = null;
//     if (role === "creator" && normalizedInstaUsername) {
//       console.log("🔍 Validating Instagram username and scraping data...");
//       const scrapeResult = await scrapeInstagramData(normalizedInstaUsername);

//       if (!scrapeResult.exists) {
//         return res.status(400).json({
//           error: "Instagram username not found or does not exist",
//           field: "instaUsername",
//           details:
//             scrapeResult.error ||
//             "The provided Instagram username could not be found",
//         });
//       }

//       scrapedData = scrapeResult.data;
//       console.log(
//         "✅ Instagram username validated and data scraped successfully"
//       );
//     }

//     // === Create new user ===
//     const newUser = new User({
//       email: normalizedEmail,
//       password: hashedPassword,
//       role,

//       // Brand fields
//       ...(role === "brand" && {
//         brandName: brandName?.trim(),
//         contactNumber: normalizedContactNumber,
//         niche: niche?.trim(),
//         ...(businessWebsite && { businessWebsite: normalizedBusinessWebsite }),
//         ...(instaLink && { instaLink: normalizedInstaLink }),
//       }),

//       // Creator fields
//       ...(role === "creator" && {
//         state: state?.trim(),
//         city: city?.trim(),
//         contactNumber: normalizedContactNumber,
//         instaUsername: normalizedInstaUsername,
//         niche: niche?.trim(),
//         ...(scrapedData && { scrapedData }),
//         // Store comment verification data
//         ...(commentVerificationResult && {
//           commentVerification: {
//             verified: true,
//             postUrl: verificationPostUrl,
//             productName: productName.trim(),
//             comment: commentVerificationResult.comment,
//             verifiedAt: new Date(),
//             commentedAt: commentVerificationResult.commentedAt
//           }
//         }),
//       }),
//     });

//     await newUser.save();

//     // === Success response ===
//     const responseData = {
//       message:
//         role === "creator"
//           ? "Creator profile registered successfully and sent to admin for approval"
//           : role === "brand"
//           ? "Brand profile registered successfully and sent to admin for approval"
//           : "User registered successfully",
//       user: {
//         id: newUser._id,
//         email: newUser.email,
//         role: newUser.role,
//         status: newUser.status,
//         ...(role === "creator" && { instaUsername: newUser.instaUsername }),
//         ...(role === "brand" && { brandName: newUser.brandName }),
//       },
//     };

//     // Add approval status message
//     if (role === "creator" || role === "brand") {
//       responseData.approvalRequired = true;
//       responseData.statusMessage =
//         "Your profile is pending admin approval. You will be notified once approved.";
//     }

//     // Add scraping status to response for creators
//     if (role === "creator") {
//       responseData.instagramDataScraped = !!scrapedData;
//       responseData.instagramUsernameValidated = true;
//       responseData.commentVerified = !!commentVerificationResult?.verified;
      
//       if (scrapedData) {
//         responseData.instagramStats = {
//           followers: scrapedData.followers,
//           engagementRate: scrapedData.engagementRate,
//           avgLikes: scrapedData.avgLikes,
//           totalUploads: scrapedData.totalUploads,
//         };
//       }

//       if (commentVerificationResult?.verified) {
//         responseData.verificationDetails = {
//           comment: commentVerificationResult.comment,
//           verifiedAt: new Date(),
//           postUrl: verificationPostUrl
//         };
//       }
//     }

//     res.status(201).json(responseData);

//     console.log("✅ User created:", newUser._id);
//     console.log("📋 User Status:", newUser.status);
//     if (role === "creator" || role === "brand") {
//       console.log("⏳ Profile sent to admin for approval");
//     }
//     if (scrapedData) {
//       console.log("📊 Instagram data included in user profile");
//     }
//     if (commentVerificationResult?.verified) {
//       console.log("✅ Comment verification completed successfully");
//     }
//     console.log("=== SIGNUP REQUEST END ===");
//   } catch (err) {
//     console.error("=== SIGNUP ERROR ===");

//     if (err.code === 11000) {
//       const field = Object.keys(err.keyPattern)[0];
//       const value = err.keyValue[field];
//       let errorMessage = `${field} already exists`;
//       if (field === "email") errorMessage = "Email already in use";
//       if (field === "contactNumber")
//         errorMessage = "Contact number already in use";
//       if (field === "instaUsername")
//         errorMessage = "Instagram username already registered";

//       return res.status(409).json({
//         error: errorMessage,
//         field,
//         value,
//       });
//     }

//     if (err.name === "ValidationError") {
//       const validationErrors = Object.values(err.errors).map((e) => e.message);
//       return res.status(400).json({
//         error: "Validation failed",
//         details: validationErrors,
//       });
//     }

//     res.status(500).json({
//       error: "Server error during registration",
//       details: process.env.NODE_ENV === "development" ? err.message : undefined,
//     });
//   }
// });





// // POST /create-admin (temporary endpoint for creating admin)
// router.post("/create-admin", async (req, res) => {
//   try {
//     console.log("=== CREATE ADMIN REQUEST START ===");
//     const { email, password, adminSecret } = req.body;

//     // Simple secret check - in production, use environment variable
//     if (adminSecret !== "my-secret-key") {
//       console.log("❌ Invalid admin secret provided");
//       return res.status(403).json({ error: "Invalid admin secret" });
//     }

//     const normalizedEmail = email.toLowerCase().trim();

//     const existingUser = await User.findOne({ email: normalizedEmail });
//     if (existingUser) {
//       console.log("❌ Admin email already exists:", normalizedEmail);
//       return res.status(409).json({ error: "Email already in use" });
//     }

//     const hashedPassword = await bcrypt.hash(password, 12);

//     const newAdmin = new User({
//       email: normalizedEmail,
//       password: hashedPassword,
//       role: "admin",
//     });

//     await newAdmin.save();
//     console.log("✅ Admin created successfully:", {
//       id: newAdmin._id,
//       email: normalizedEmail,
//     });

//     res.status(201).json({ message: "Admin user created successfully" });
//     console.log("=== CREATE ADMIN REQUEST END ===");
//   } catch (err) {
//     console.error("=== CREATE ADMIN ERROR ===");
//     console.error("Error details:", err);
//     res.status(500).json({ error: "Server error" });
//   }
// });

// // POST /signin
// router.post("/signin", async (req, res) => {
//   try {
//     console.log("=== SIGNIN REQUEST START ===");
//     console.log("Request body:", {
//       email: req.body.email,
//       password: "[HIDDEN]",
//     });
//     console.log("Request headers:", req.headers);

//     const { email, password } = req.body;

//     if (!email || !password) {
//       console.log("❌ Validation failed: Missing email or password");
//       return res.status(400).json({
//         error: "Email and password are required",
//         received: { email: !!email, password: !!password },
//       });
//     }

//     const normalizedEmail = email.toLowerCase().trim();

//     console.log("🔍 Looking for user with email:", normalizedEmail);
//     const user = await User.findOne({ email: normalizedEmail });
//     if (!user) {
//       console.log("❌ User not found:", normalizedEmail);
//       return res.status(404).json({ error: "User not found" });
//     }

//     console.log("✅ User found:", {
//       id: user._id,
//       email: user.email,
//       role: user.role,
//       status: user.status,
//     });

//     // Check if user is approved (for creators and brands)
//     if (user.role !== "admin" && user.status !== "approved") {
//       console.log(`❌ User not approved: ${user.status}`);
//       return res.status(403).json({
//         error: "Account not approved yet",
//         status: user.status,
//         message:
//           user.status === "pending"
//             ? "Your account is pending admin approval"
//             : "Your account has been rejected",
//       });
//     }

//     console.log("🔒 Comparing password...");
//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) {
//       console.log("❌ Invalid password for user:", normalizedEmail);
//       return res.status(401).json({ error: "Invalid credentials" });
//     }

//     if (!process.env.JWT_SECRET) {
//       console.error("❌ JWT_SECRET not configured");
//       return res.status(500).json({ error: "Server configuration error" });
//     }

//     console.log("🎫 Generating JWT token...");
//     const token = jwt.sign(
//       {
//         id: user._id,
//         role: user.role,
//         email: user.email,
//         status: user.status,
//       },
//       process.env.JWT_SECRET,
//       { expiresIn: "7d" }
//     );

//     // Build user response based on role
//     const userResponse = {
//       id: user._id,
//       email: user.email,
//       role: user.role,
//       status: user.status,
//     };

//     // Add role-specific fields
//     if (user.role === "creator") {
//       userResponse.instaUsername = user.instaUsername;
//       userResponse.state = user.state;
//       userResponse.city = user.city;
//       userResponse.niche = user.niche;
//       userResponse.contactNumber = user.contactNumber;
//       if (user.scrapedData) {
//         userResponse.instagramStats = {
//           followers: user.scrapedData.followers,
//           engagementRate: user.scrapedData.engagementRate,
//           avgLikes: user.scrapedData.avgLikes,
//           totalUploads: user.scrapedData.totalUploads,
//         };
//       }
//     } else if (user.role === "brand") {
//       userResponse.brandName = user.brandName;
//       userResponse.niche = user.niche;
//       userResponse.contactNumber = user.contactNumber;
//       if (user.businessWebsite)
//         userResponse.businessWebsite = user.businessWebsite;
//       if (user.instaLink) userResponse.instaLink = user.instaLink;
//     }

//     console.log("✅ User signed in successfully:", {
//       id: user._id,
//       email: normalizedEmail,
//       role: user.role,
//       status: user.status,
//     });

//     res.status(200).json({
//       message: "Sign in successful",
//       token,
//       user: userResponse,
//     });

//     console.log("=== SIGNIN REQUEST END ===");
//   } catch (err) {
//     console.error("=== SIGNIN ERROR ===");
//     console.error("Error details:", err);
//     console.error("Stack trace:", err.stack);
//     res.status(500).json({
//       error: "Server error during sign in",
//       details: process.env.NODE_ENV === "development" ? err.message : undefined,
//     });
//   }
// });

// // POST /forgot-password
// router.post("/forgot-password", async (req, res) => {
//   try {
//     console.log("=== FORGOT PASSWORD REQUEST ===");
//     const { email } = req.body;

//     if (!email) {
//       return res.status(400).json({ error: "Email is required" });
//     }

//     const normalizedEmail = email.toLowerCase().trim();

//     const user = await User.findOne({ email: normalizedEmail });
//     if (!user) {
//       console.log("❌ User not found for password reset:", normalizedEmail);
//       return res.status(404).json({ error: "User not found" });
//     }

//     const token = crypto.randomBytes(32).toString("hex");
//     user.resetToken = token;
//     user.resetTokenExpiry = Date.now() + 1000 * 60 * 60; // 1 hour
//     await user.save();

//     // Replace this with actual email sending logic
//     const resetLink = `${
//       process.env.FRONTEND_URL || "http://localhost:3000"
//     }/reset-password/${token}`;
//     console.log(`🔗 Reset link: ${resetLink}`);

//     res.status(200).json({
//       message: "Reset link sent (check server log)",
//       resetLink: process.env.NODE_ENV === "development" ? resetLink : undefined,
//     });
//   } catch (err) {
//     console.error("Forgot password error:", err);
//     res.status(500).json({ error: "Server error" });
//   }
// });

// // POST /reset-password
// router.post("/reset-password", async (req, res) => {
//   try {
//     console.log("=== RESET PASSWORD REQUEST ===");
//     const { token, newPassword } = req.body;

//     if (!token || !newPassword) {
//       return res.status(400).json({ 
//         error: "Token and new password are required" 
//       });
//     }

//     if (newPassword.length < 6) {
//       return res.status(400).json({
//         error: "Password must be at least 6 characters long",
//       });
//     }

//     console.log("🔍 Looking for user with reset token...");
//     const user = await User.findOne({
//       resetToken: token,
//       resetTokenExpiry: { $gt: Date.now() }, // Token must not be expired
//     });

//     if (!user) {
//       console.log("❌ Invalid or expired reset token");
//       return res.status(400).json({ 
//         error: "Invalid or expired reset token" 
//       });
//     }

//     console.log("✅ Valid reset token found for user:", user.email);
//     console.log("🔒 Hashing new password...");
    
//     // Hash the new password
//     const hashedPassword = await bcrypt.hash(newPassword, 12);
    
//     // Update user password and clear reset token
//     user.password = hashedPassword;
//     user.resetToken = undefined;
//     user.resetTokenExpiry = undefined;
//     await user.save();

//     console.log("✅ Password reset successful for user:", user.email);

//     res.status(200).json({
//       message: "Password reset successful",
//       user: {
//         id: user._id,
//         email: user.email,
//         role: user.role,
//       },
//     });

//     console.log("=== RESET PASSWORD REQUEST END ===");
//   } catch (err) {
//     console.error("=== RESET PASSWORD ERROR ===");
//     console.error("Error details:", err);
//     res.status(500).json({ 
//       error: "Server error during password reset",
//       details: process.env.NODE_ENV === "development" ? err.message : undefined,
//     });
//   }
// });

// // GET /reset-password/:token (Optional - to verify token before showing reset form)
// router.get("/reset-password/:token", async (req, res) => {
//   try {
//     console.log("=== VERIFY RESET TOKEN REQUEST ===");
//     const { token } = req.params;

//     if (!token) {
//       return res.status(400).json({ error: "Token is required" });
//     }

//     console.log("🔍 Verifying reset token...");
//     const user = await User.findOne({
//       resetToken: token,
//       resetTokenExpiry: { $gt: Date.now() },
//     });

//     if (!user) {
//       console.log("❌ Invalid or expired reset token");
//       return res.status(400).json({ 
//         error: "Invalid or expired reset token" 
//       });
//     }

//     console.log("✅ Valid reset token for user:", user.email);
    
//     res.status(200).json({
//       message: "Valid reset token",
//       email: user.email, // Can show user which email this reset is for
//     });

//     console.log("=== VERIFY RESET TOKEN REQUEST END ===");
//   } catch (err) {
//     console.error("=== VERIFY RESET TOKEN ERROR ===");
//     console.error("Error details:", err);
//     res.status(500).json({ 
//       error: "Server error during token verification",
//       details: process.env.NODE_ENV === "development" ? err.message : undefined,
//     });
//   }
// });



// module.exports = router;


// backend/routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const { ApifyClient } = require("apify-client");

const router = express.Router();

// Middleware to log route access
router.use((req, res, next) => {
  console.log(`🔐 Auth route: ${req.method} ${req.path}`);
  next();
});

const apifyClient = new ApifyClient({
  token: `${process.env.APIFY_API_TOKEN}`,
});

// Function to scrape Instagram post comments
async function scrapeInstagramComments(postUrl) {
  try {
    console.log(`🔍 Starting Instagram comment scrape for post: ${postUrl}`);

    const input = {
      directUrls: [postUrl],
      resultsLimit: 100, // Increase limit to get more comments
    };

    const run = await apifyClient.actor("SbK00X0JYCPblD2wp").call(input);
    const { items } = await apifyClient
      .dataset(run.defaultDatasetId)
      .listItems();

    if (items.length === 0) {
      console.log("❌ No data found for the Instagram post");
      return { success: false, comments: [], error: "Post not found or no comments" };
    }

    const postData = items[0];
    const comments = postData.comments || [];

    console.log(`✅ Successfully scraped ${comments.length} comments`);
    return { success: true, comments, postData };
  } catch (error) {
    console.error("❌ Error during Instagram comment scrape:", error.message);
    return { success: false, comments: [], error: error.message };
  }
}

// Function to verify if user commented with product name
async function verifyUserComment(instaUsername, postUrl, requiredProductName) {
  try {
    console.log(`🔍 Verifying comment by @${instaUsername} for product: ${requiredProductName}`);

    const scrapeResult = await scrapeInstagramComments(postUrl);
    
    if (!scrapeResult.success) {
      return {
        verified: false,
        error: scrapeResult.error,
        message: "Failed to scrape comments from the post"
      };
    }

    const { comments } = scrapeResult;
    
    // Clean the username (remove @ if present)
    const cleanUsername = instaUsername.replace(/^@/, "").toLowerCase().trim();
    const productNameLower = requiredProductName.toLowerCase().trim();

    // Find comments by the user
    const userComments = comments.filter(comment => {
      const commentUsername = comment.ownerUsername?.toLowerCase().trim();
      return commentUsername === cleanUsername;
    });

    if (userComments.length === 0) {
      return {
        verified: false,
        message: `No comments found by @${instaUsername} on this post`,
        totalComments: comments.length
      };
    }

    // Check if any of the user's comments contain the product name
    const verifiedComment = userComments.find(comment => {
      const commentText = comment.text?.toLowerCase().trim() || "";
      return commentText.includes(productNameLower);
    });

    if (verifiedComment) {
      console.log(`✅ Verification successful! Found comment: "${verifiedComment.text}"`);
      return {
        verified: true,
        message: "Comment verification successful",
        comment: verifiedComment.text,
        commentedAt: verifiedComment.timestamp,
        userComments: userComments.length,
        totalComments: comments.length
      };
    } else {
      return {
        verified: false,
        message: `@${instaUsername} commented on the post but didn't mention "${requiredProductName}"`,
        userComments: userComments.map(c => c.text),
        totalComments: comments.length
      };
    }
  } catch (error) {
    console.error("❌ Error during comment verification:", error.message);
    return {
      verified: false,
      error: error.message,
      message: "Error occurred during comment verification"
    };
  }
}
async function scrapeInstagramData(instaUsername) {
  try {
    console.log(`🔍 Starting Instagram scrape for: ${instaUsername}`);

    // Clean the username (remove @ if present)
    const cleanUsername = instaUsername.replace(/^@/, "").toLowerCase().trim();

    const input = {
      usernames: [cleanUsername],
    };

    const run = await apifyClient.actor("dSCLg0C3YEZ83HzYX").call(input);
    const { items } = await apifyClient
      .dataset(run.defaultDatasetId)
      .listItems();

    if (items.length === 0) {
      console.log("❌ Instagram username not found:", cleanUsername);
      return { exists: false, data: null };
    }

    const profile = items[0];
    const followers = Number(profile.followersCount) || 0;
    const totalUploads = Number(profile.postsCount) || 0;
    const profilePicHD = profile.profilePicUrlHD || "";
    const posts = profile.latestPosts || [];

    let totalLikes = 0;
    let totalComments = 0;
    let totalEngagement = 0;
    let postDates = [];

    posts.forEach((post) => {
      const likes = Number(post.likesCount) || 0;
      const comments = Number(post.commentsCount) || 0;
      const timestamp = post.timestamp ? new Date(post.timestamp) : null;

      totalLikes += likes;
      totalComments += comments;
      if (timestamp) postDates.push(timestamp);

      if (followers > 0) {
        const engagement = ((likes + comments) / followers) * 100;
        totalEngagement += engagement;
      }
    });

    const postCount = posts.length;
    const avgLikes = postCount ? Math.round(totalLikes / postCount) : 0;
    const avgComments = postCount ? Math.round(totalComments / postCount) : 0;
    const engagementRate = postCount
      ? (totalEngagement / postCount).toFixed(2)
      : "0.00";

    let postsPerWeek = 0;
    if (postDates.length >= 2) {
      postDates.sort((a, b) => b - a);
      const durationWeeks =
        (postDates[0] - postDates[postDates.length - 1]) /
        (1000 * 60 * 60 * 24 * 7);
      postsPerWeek =
        durationWeeks > 0
          ? Number((postCount / durationWeeks).toFixed(2))
          : postCount;
    }

    const topPostLinks = posts.slice(0, 3).map((p) => p.displayUrl || "");

    const scrapedData = {
      followers,
      totalUploads,
      avgLikes,
      avgComments,
      postsPerWeek,
      engagementRate,
      profileHD: profilePicHD,
      post1: topPostLinks[0] || "",
      post2: topPostLinks[1] || "",
      post3: topPostLinks[2] || "",
    };

    console.log("✅ Instagram scrape completed successfully");
    return { exists: true, data: scrapedData };
  } catch (error) {
    console.error("❌ Error during Instagram scrape:", error.message);
    return { exists: false, data: null, error: error.message };
  }
}
// POST /signup
router.post("/signup", async (req, res) => {
  try {
    console.log("=== SIGNUP REQUEST START ===");

    const {
      email,
      password,
      role,
      // Brand fields
      brandName,
      contactNumber,
      niche,
      businessWebsite, // optional
      instaLink, // optional
      // Creator fields
      state,
      city,
      instaUsername,
      // Comment verification fields (for creators)
      verificationPostUrl,
      productName,
    } = req.body;

    // === Basic validation ===
    if (!email || !password || !role) {
      return res.status(400).json({
        error: "Email, password, and role are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters long",
      });
    }

    if (!["creator", "brand", "admin"].includes(role)) {
      return res.status(400).json({
        error: "Invalid role specified. Must be 'creator', 'brand', or 'admin'",
      });
    }

    // === Role-specific validation ===
    if (role === "brand") {
      if (!brandName || !contactNumber || !niche) {
        return res.status(400).json({
          error: "Missing required fields for brand",
          required: ["brandName", "contactNumber", "niche"],
        });
      }
    }

    if (role === "creator") {
      if (!state || !city || !contactNumber || !instaUsername || !niche) {
        return res.status(400).json({
          error: "Missing required fields for creator",
          required: [
            "state",
            "city",
            "contactNumber",
            "instaUsername",
            "niche",
          ],
        });
      }

      // Comment verification validation for creators
      if (!verificationPostUrl || !productName) {
        return res.status(400).json({
          error: "Comment verification is required for creators",
          required: ["verificationPostUrl", "productName"],
          message: "Please provide the Instagram post URL and product name for verification"
        });
      }

      // Validate Instagram post URL format
      const instagramPostRegex = /^https:\/\/(www\.)?instagram\.com\/(p|reel)\/[A-Za-z0-9_-]+/;
      if (!instagramPostRegex.test(verificationPostUrl)) {
        return res.status(400).json({
          error: "Invalid Instagram post URL format",
          message: "Please provide a valid Instagram post or reel URL"
        });
      }
      // Instagram username validation
      const normalizedInstaUsername = instaUsername.toLowerCase().trim();
      if (!/^[a-zA-Z0-9_.]+$/.test(normalizedInstaUsername)) {
        return res.status(400).json({
          error:
            "Instagram username can only contain letters, numbers, dots, and underscores",
        });
      }

      if (
        normalizedInstaUsername.length < 1 ||
        normalizedInstaUsername.length > 30
      ) {
        return res.status(400).json({
          error: "Instagram username must be between 1 and 30 characters",
        });
      }

      // Check Instagram username uniqueness
      const instaUsernameTaken = await User.findOne({
        instaUsername: normalizedInstaUsername,
      });
      if (instaUsernameTaken) {
        return res.status(409).json({
          error: "Instagram username already registered",
          field: "instaUsername",
        });
      }
    }

    // === Normalize inputs ===
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedContactNumber = contactNumber?.trim();
    const normalizedInstaUsername = instaUsername?.toLowerCase().trim();
    const normalizedInstaLink = instaLink?.toLowerCase().trim();
    const normalizedBusinessWebsite = businessWebsite?.toLowerCase().trim();

    // === Check email uniqueness ===
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        error: "Email already in use",
        field: "email",
      });
    }

    // === Check contact number uniqueness ===
    if (normalizedContactNumber) {
      const contactNumberTaken = await User.findOne({
        contactNumber: normalizedContactNumber,
      });
      if (contactNumberTaken) {
        return res.status(409).json({
          error: "Contact number already in use",
          field: "contactNumber",
        });
      }
    }

    // === Comment verification for creators ===
    let commentVerificationResult = null;
    if (role === "creator" && normalizedInstaUsername && verificationPostUrl && productName) {
      console.log("🔍 Starting comment verification process...");
      
      commentVerificationResult = await verifyUserComment(
        normalizedInstaUsername,
        verificationPostUrl,
        productName.trim()
      );

      if (!commentVerificationResult.verified) {
        return res.status(400).json({
          error: "Comment verification failed",
          field: "commentVerification",
          details: commentVerificationResult.message,
          verificationData: {
            userComments: commentVerificationResult.userComments || [],
            totalComments: commentVerificationResult.totalComments || 0,
            requiredProductName: productName.trim()
          },
          instructions: `Please comment "${productName.trim()}" on the Instagram post and try again`
        });
      }

      console.log("✅ Comment verification successful!");
    }
    // === Hash password ===
    const hashedPassword = await bcrypt.hash(password, 12);

    // === Scrape Instagram data for creators and validate username ===
    let scrapedData = null;
    if (role === "creator" && normalizedInstaUsername) {
      console.log("🔍 Validating Instagram username and scraping data...");
      const scrapeResult = await scrapeInstagramData(normalizedInstaUsername);

      if (!scrapeResult.exists) {
        return res.status(400).json({
          error: "Instagram username not found or does not exist",
          field: "instaUsername",
          details:
            scrapeResult.error ||
            "The provided Instagram username could not be found",
        });
      }

      scrapedData = scrapeResult.data;
      console.log(
        "✅ Instagram username validated and data scraped successfully"
      );
    }

    // === Create new user ===
    const newUser = new User({
      email: normalizedEmail,
      password: hashedPassword,
      role,

      // Brand fields
      ...(role === "brand" && {
        brandName: brandName?.trim(),
        contactNumber: normalizedContactNumber,
        niche: niche?.trim(),
        ...(businessWebsite && { businessWebsite: normalizedBusinessWebsite }),
        ...(instaLink && { instaLink: normalizedInstaLink }),
      }),

      // Creator fields
      ...(role === "creator" && {
        state: state?.trim(),
        city: city?.trim(),
        contactNumber: normalizedContactNumber,
        instaUsername: normalizedInstaUsername,
        niche: niche?.trim(),
        ...(scrapedData && { scrapedData }),
        // Store comment verification data
        ...(commentVerificationResult && {
          commentVerification: {
            verified: true,
            postUrl: verificationPostUrl,
            productName: productName.trim(),
            comment: commentVerificationResult.comment,
            verifiedAt: new Date(),
            commentedAt: commentVerificationResult.commentedAt
          }
        }),
      }),
    });

    await newUser.save();

    // === Success response ===
    const responseData = {
      message:
        role === "creator"
          ? "Creator profile registered successfully"
          : role === "brand"
          ? "Brand profile registered successfully"
          : "User registered successfully",
      user: {
        id: newUser._id,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
        ...(role === "creator" && { instaUsername: newUser.instaUsername }),
        ...(role === "brand" && { brandName: newUser.brandName }),
      },
    };

    // Add scraping status to response for creators
    if (role === "creator") {
      responseData.instagramDataScraped = !!scrapedData;
      responseData.instagramUsernameValidated = true;
      responseData.commentVerified = !!commentVerificationResult?.verified;
      
      if (scrapedData) {
        responseData.instagramStats = {
          followers: scrapedData.followers,
          engagementRate: scrapedData.engagementRate,
          avgLikes: scrapedData.avgLikes,
          totalUploads: scrapedData.totalUploads,
        };
      }

      if (commentVerificationResult?.verified) {
        responseData.verificationDetails = {
          comment: commentVerificationResult.comment,
          verifiedAt: new Date(),
          postUrl: verificationPostUrl
        };
      }
    }

    res.status(201).json(responseData);

    console.log("✅ User created:", newUser._id);
    console.log("📋 User Status:", newUser.status);
    if (role === "creator" || role === "brand") {
      console.log("⏳ Profile sent to admin for approval");
    }
    if (scrapedData) {
      console.log("📊 Instagram data included in user profile");
    }
    if (commentVerificationResult?.verified) {
      console.log("✅ Comment verification completed successfully");
    }
    console.log("=== SIGNUP REQUEST END ===");
  } catch (err) {
    console.error("=== SIGNUP ERROR ===");

    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      const value = err.keyValue[field];
      let errorMessage = `${field} already exists`;
      if (field === "email") errorMessage = "Email already in use";
      if (field === "contactNumber")
        errorMessage = "Contact number already in use";
      if (field === "instaUsername")
        errorMessage = "Instagram username already registered";

      return res.status(409).json({
        error: errorMessage,
        field,
        value,
      });
    }

    if (err.name === "ValidationError") {
      const validationErrors = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({
        error: "Validation failed",
        details: validationErrors,
      });
    }

    res.status(500).json({
      error: "Server error during registration",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});





// POST /create-admin (temporary endpoint for creating admin)
router.post("/create-admin", async (req, res) => {
  try {
    console.log("=== CREATE ADMIN REQUEST START ===");
    const { email, password, adminSecret } = req.body;

    // Simple secret check - in production, use environment variable
    if (adminSecret !== "my-secret-key") {
      console.log("❌ Invalid admin secret provided");
      return res.status(403).json({ error: "Invalid admin secret" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      console.log("❌ Admin email already exists:", normalizedEmail);
      return res.status(409).json({ error: "Email already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newAdmin = new User({
      email: normalizedEmail,
      password: hashedPassword,
      role: "admin",
    });

    await newAdmin.save();
    console.log("✅ Admin created successfully:", {
      id: newAdmin._id,
      email: normalizedEmail,
    });

    res.status(201).json({ message: "Admin user created successfully" });
    console.log("=== CREATE ADMIN REQUEST END ===");
  } catch (err) {
    console.error("=== CREATE ADMIN ERROR ===");
    console.error("Error details:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /signin
router.post("/signin", async (req, res) => {
  try {
    console.log("=== SIGNIN REQUEST START ===");
    console.log("Request body:", {
      email: req.body.email,
      password: "[HIDDEN]",
    });
    console.log("Request headers:", req.headers);

    const { email, password } = req.body;

    if (!email || !password) {
      console.log("❌ Validation failed: Missing email or password");
      return res.status(400).json({
        error: "Email and password are required",
        received: { email: !!email, password: !!password },
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    console.log("🔍 Looking for user with email:", normalizedEmail);
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      console.log("❌ User not found:", normalizedEmail);
      return res.status(404).json({ error: "User not found" });
    }

    console.log("✅ User found:", {
      id: user._id,
      email: user.email,
      role: user.role,
      status: user.status,
    });

    // Check if user is banned
    if (user.status === "banned") {
      console.log(`❌ User is banned: ${user.status}`);
      return res.status(403).json({
        error: "Account is banned",
        status: user.status,
        message: "Your account has been banned by an administrator",
        banReason: user.banReason || "No reason provided",
        bannedAt: user.bannedAt,
      });
    }

    console.log("🔒 Comparing password...");
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("❌ Invalid password for user:", normalizedEmail);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!process.env.JWT_SECRET) {
      console.error("❌ JWT_SECRET not configured");
      return res.status(500).json({ error: "Server configuration error" });
    }

    console.log("🎫 Generating JWT token...");
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        email: user.email,
        status: user.status,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Build user response based on role
    const userResponse = {
      id: user._id,
      email: user.email,
      role: user.role,
      status: user.status,
    };

    // Add role-specific fields
    if (user.role === "creator") {
      userResponse.instaUsername = user.instaUsername;
      userResponse.state = user.state;
      userResponse.city = user.city;
      userResponse.niche = user.niche;
      userResponse.contactNumber = user.contactNumber;
      if (user.scrapedData) {
        userResponse.instagramStats = {
          followers: user.scrapedData.followers,
          engagementRate: user.scrapedData.engagementRate,
          avgLikes: user.scrapedData.avgLikes,
          totalUploads: user.scrapedData.totalUploads,
        };
      }
    } else if (user.role === "brand") {
      userResponse.brandName = user.brandName;
      userResponse.niche = user.niche;
      userResponse.contactNumber = user.contactNumber;
      if (user.businessWebsite)
        userResponse.businessWebsite = user.businessWebsite;
      if (user.instaLink) userResponse.instaLink = user.instaLink;
    }

    console.log("✅ User signed in successfully:", {
      id: user._id,
      email: normalizedEmail,
      role: user.role,
      status: user.status,
    });

    res.status(200).json({
      message: "Sign in successful",
      token,
      user: userResponse,
    });

    console.log("=== SIGNIN REQUEST END ===");
  } catch (err) {
    console.error("=== SIGNIN ERROR ===");
    console.error("Error details:", err);
    console.error("Stack trace:", err.stack);
    res.status(500).json({
      error: "Server error during sign in",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

// POST /forgot-password
router.post("/forgot-password", async (req, res) => {
  try {
    console.log("=== FORGOT PASSWORD REQUEST ===");
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      console.log("❌ User not found for password reset:", normalizedEmail);
      return res.status(404).json({ error: "User not found" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    user.resetToken = token;
    user.resetTokenExpiry = Date.now() + 1000 * 60 * 60; // 1 hour
    await user.save();

    // Replace this with actual email sending logic
    const resetLink = `${
      process.env.FRONTEND_URL || "http://localhost:3000"
    }/reset-password/${token}`;
    console.log(`🔗 Reset link: ${resetLink}`);

    res.status(200).json({
      message: "Reset link sent (check server log)",
      resetLink: process.env.NODE_ENV === "development" ? resetLink : undefined,
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /reset-password
router.post("/reset-password", async (req, res) => {
  try {
    console.log("=== RESET PASSWORD REQUEST ===");
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ 
        error: "Token and new password are required" 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters long",
      });
    }

    console.log("🔍 Looking for user with reset token...");
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() }, // Token must not be expired
    });

    if (!user) {
      console.log("❌ Invalid or expired reset token");
      return res.status(400).json({ 
        error: "Invalid or expired reset token" 
      });
    }

    console.log("✅ Valid reset token found for user:", user.email);
    console.log("🔒 Hashing new password...");
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    // Update user password and clear reset token
    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    console.log("✅ Password reset successful for user:", user.email);

    res.status(200).json({
      message: "Password reset successful",
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      },
    });

    console.log("=== RESET PASSWORD REQUEST END ===");
  } catch (err) {
    console.error("=== RESET PASSWORD ERROR ===");
    console.error("Error details:", err);
    res.status(500).json({ 
      error: "Server error during password reset",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

// GET /reset-password/:token (Optional - to verify token before showing reset form)
router.get("/reset-password/:token", async (req, res) => {
  try {
    console.log("=== VERIFY RESET TOKEN REQUEST ===");
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    console.log("🔍 Verifying reset token...");
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      console.log("❌ Invalid or expired reset token");
      return res.status(400).json({ 
        error: "Invalid or expired reset token" 
      });
    }

    console.log("✅ Valid reset token for user:", user.email);
    
    res.status(200).json({
      message: "Valid reset token",
      email: user.email, // Can show user which email this reset is for
    });

    console.log("=== VERIFY RESET TOKEN REQUEST END ===");
  } catch (err) {
    console.error("=== VERIFY RESET TOKEN ERROR ===");
    console.error("Error details:", err);
    res.status(500).json({ 
      error: "Server error during token verification",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});



module.exports = router;

