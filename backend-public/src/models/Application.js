const mongoose = require("mongoose");
const applicationSchema = new mongoose.Schema({

    
},{timestamps: true});
module.exports = mongoose.model("Application", applicationSchema);