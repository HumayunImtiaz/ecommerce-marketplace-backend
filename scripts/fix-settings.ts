import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import SiteSettings from "../src/modules/admin/models/site-settings.model";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function fixSettings() {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log("Connected to MongoDB");
    
    const settings = await SiteSettings.findOne();
    if (settings) {
      console.log("Old Admin Email:", settings.adminEmail);
      settings.adminEmail = "humayunimtiaz34@gmail.com"; // Setting a valid one
      await settings.save();
      console.log("Updated Admin Email to:", settings.adminEmail);
    } else {
      console.warn("No Site Settings found to update.");
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error("Error fixing settings:", error);
  }
}

fixSettings();
