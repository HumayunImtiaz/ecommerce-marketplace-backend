import dotenv from "dotenv";
import prisma from "../config/prisma";
import bcrypt from "bcryptjs";
import { ROLE } from "../utils/enums/role";

dotenv.config();

const seedAdmin = async (): Promise<void> => {
  try {
    const email = "admin@example.com";
    const password = "Admin@123";

    const existingAdmin = await prisma.user.findFirst({
      where: { email, role: ROLE.ADMIN },
    });

    if (existingAdmin) {
      console.log("Admin already exists in Neon DB");
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        fullName: "Super Admin",
        email,
        password: hashedPassword,
        role: ROLE.ADMIN,
        provider: "local",
        isVerified: true,
      },
    });

    console.log("Admin seeded successfully in Neon DB");
    process.exit(0);
  } catch (error) {
    console.error("Admin seeding failed:", error);
    process.exit(1);
  }
};

seedAdmin();