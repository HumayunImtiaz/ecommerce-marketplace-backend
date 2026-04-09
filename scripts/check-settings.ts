import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import SiteSettings from "../src/modules/admin/models/site-settings.model";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function checkSettings() {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log("Connected to MongoDB");
    
    const settings = await SiteSettings.findOne();
    if (settings) {
      console.log("Current Site Settings:");
      console.log("- Store Name:", settings.storeName);
      console.log("- Admin Email:", settings.adminEmail);
      console.log("- Contact Email:", settings.contact.email);
    } else {
      console.warn("No Site Settings found in database!");
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error("Error checking settings:", error);
  }
}

checkSettings();
