import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../src/modules/user/models/user.model";
import generateToken from "../src/utils/jwt";
import { ROLE } from "../src/utils/enums/role";
import connectDB from "../src/config/db";

dotenv.config();

const getAdminToken = async () => {
  try {
    await connectDB();
    const admin = await User.findOne({ email: "admin@example.com", role: ROLE.ADMIN });
    if (!admin) {
      console.log("Admin not found");
      process.exit(1);
    }
    const token = generateToken({ id: admin._id.toString(), email: admin.email, role: ROLE.ADMIN });
    console.log("TOKEN_START");
    console.log(token);
    console.log("TOKEN_END");
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

getAdminToken();
