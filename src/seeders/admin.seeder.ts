import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db";
import User from "../modules/user/models/user.model";

dotenv.config();

const seedAdmin = async (): Promise<void> => {
  try {
    await connectDB();

    const existingAdmin: any = await User.findOne({
      email: "admin@example.com",
    });

    if (existingAdmin && existingAdmin.role === "admin") {
      console.log("Admin already exists");
      await mongoose.connection.close();
      process.exit(0);
    }

    const adminData: any = {
      fullName: "Super Admin",
      email: "admin@example.com",
      password: "Admin@123",
      role: "admin",
      provider: "local",
      isVerified: true,
      avatar: null,
      providerId: null,
      deletedAt: null,
      deletedBy: null,
      resetPasswordToken: null,
      resetPasswordExpires: null,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    };

    const admin = new User(adminData);
    await admin.save();

    console.log("Admin seeded successfully");
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Admin seeding failed:", error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

seedAdmin();