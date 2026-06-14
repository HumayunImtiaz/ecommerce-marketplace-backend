import dotenv from "dotenv";
import prisma from "../config/prisma";
import bcrypt from "bcryptjs";
import { ROLE } from "../utils/enums/role";

dotenv.config();

const seedVendor = async (): Promise<void> => {
  try {
    const email = "vendor@luxacart.com";
    const password = "vendor123";

    const existingUser = await prisma.user.findFirst({
      where: { email, role: ROLE.VENDOR },
    });

    let userId: string;

    if (existingUser) {
      console.log("Vendor user already exists");
      userId = existingUser.id;
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          fullName: "Official Vendor",
          email,
          password: hashedPassword,
          role: ROLE.VENDOR as any,
          provider: "local",
          isVerified: true,
        },
      });
      console.log("Vendor user created successfully");
      userId = user.id;
    }

    // Check if vendor profile exists
    const existingVendor = await prisma.vendor.findUnique({
      where: { userId },
    });

    if (!existingVendor) {
      await prisma.vendor.create({
        data: {
          userId,
          businessName: "LuxaCart Official Store",
          slug: "luxacart-official",
          description: "This is the official vendor for LuxaCart.",
          status: "APPROVED",
          commissionRate: 10.0,
        },
      });
      console.log("Vendor profile created successfully");
    } else {
      console.log("Vendor profile already exists");
    }

    process.exit(0);
  } catch (error) {
    console.error("Vendor seeding failed:", error);
    process.exit(1);
  }
};

seedVendor();
