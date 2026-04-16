import dotenv from "dotenv";
import prisma from "../config/prisma";
import bcrypt from "bcryptjs";

dotenv.config();

const seedAdmin = async (): Promise<void> => {
  try {
    const email = "admin@example.com";
    const password = "Admin@123";

    const existingAdmin = await prisma.user.findFirst({
      where: { email, role: "admin" },
    });

    if (existingAdmin) {
      console.log("Admin already exists in Neon DB");
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const adminData = {
      fullName: "Super Admin",
      email,
      password: hashedPassword,
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

    await prisma.user.create({
      data: adminData,
    });

    console.log("Admin seeded successfully in Neon DB");
    process.exit(0);
  } catch (error) {
    console.error("Admin seeding failed:", error);
    process.exit(1);
  }
};

seedAdmin();