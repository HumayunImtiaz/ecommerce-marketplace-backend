import generateToken from "../../../utils/jwt";
import { ROLE } from "../../../utils/enums/role";
import User from "../../user/models/user.model";
import { adminAuthValidation } from "../validations/admin.auth.validation";
import { z } from "zod";

type FieldError = { field: string; message: string };
type ServiceResponse<T = unknown> = {
  success: boolean;
  statusCode: number;
  message: string;
  data: T | null;
  errors?: FieldError[];
};

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Confirm password is required"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters").optional(),
  email: z.string().trim().email("Please provide a valid email").optional(),
  bio: z.union([z.string().trim().max(500, "Bio cannot exceed 500 characters"), z.null()]).optional(),
});


const adminLoginService = async (body: any): Promise<ServiceResponse<{
  admin: { id: unknown; fullName: string; email: string; bio: string | null; lastLogin: Date | null };
  token: string;
}>> => {
  try {
    const validation = adminAuthValidation.adminLoginSchema.safeParse(body);
    if (!validation.success) {
      const fieldErrors = validation.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
      return { success: false, statusCode: 400, message: `Validation failed: ${fieldErrors.map((e) => e.message).join(", ")}`, data: null, errors: fieldErrors };
    }

    const { email, password } = validation.data;
    const admin = await User.findOne({ email, role: ROLE.ADMIN }).select("+password");

    if (!admin) return { success: false, statusCode: 401, message: "Invalid admin email or password", data: null, errors: [{ field: "email", message: "Invalid email or password" }] };

    const isPasswordMatched = await admin.comparePassword(password);
    if (!isPasswordMatched) return { success: false, statusCode: 401, message: "Invalid admin email or password", data: null, errors: [{ field: "password", message: "Invalid email or password" }] };

    // ── Record last login time ──
    admin.lastLogin = new Date();
    await admin.save();

    const token = generateToken({ id: admin._id.toString(), email: admin.email, role: ROLE.ADMIN });

    return {
      success: true,
      statusCode: 200,
      message: "Admin login successful",
      data: {
        admin: { id: admin._id, fullName: admin.fullName, email: admin.email, bio: admin.bio ?? null, lastLogin: admin.lastLogin },
        token,
      },
    };
  } catch (error: any) {
    console.error("adminLoginService error:", error);
    return { success: false, statusCode: 500, message: `Admin login failed: ${error.message || "unknown error"}`, data: null };
  }
};

// ─── Get All Users ────────────────────────────────────────────────────────────
const getAllUsersService = async (): Promise<ServiceResponse> => {
  try {
    const users = await User.find({ role: ROLE.USER })
      .select("fullName email avatar role isVerified isDeleted deletedAt deletedBy provider createdAt updatedAt")
      .sort({ createdAt: -1 });

    return {
      success: true,
      statusCode: 200,
      message: "Users fetched successfully",
      data: users.map((u: any) => ({
        id: u._id, fullName: u.fullName, email: u.email, avatar: u.avatar,
        role: u.role, isVerified: u.isVerified, isDeleted: u.isDeleted,
        deletedAt: u.deletedAt, deletedBy: u.deletedBy, provider: u.provider,
        createdAt: u.createdAt, updatedAt: u.updatedAt,
      })),
    };
  } catch (error: any) {
    console.error("getAllUsersService error:", error);
    return { success: false, statusCode: 500, message: `Failed to fetch users: ${error.message || "unknown error"}`, data: null };
  }
};

// ─── Temporary Delete User ────────────────────────────────────────────────────
const temporaryDeleteUserService = async (userId: string, adminId: string): Promise<ServiceResponse<null>> => {
  try {
    if (!userId?.trim()) return { success: false, statusCode: 400, message: "User ID is required", data: null, errors: [{ field: "userId", message: "User ID is required" }] };
    if (!adminId?.trim()) return { success: false, statusCode: 401, message: "Unauthorized", data: null };

    const user = await User.findOne({ _id: userId, role: ROLE.USER });
    if (!user) return { success: false, statusCode: 404, message: `No user found with ID "${userId}"`, data: null, errors: [{ field: "userId", message: `No user found with ID "${userId}"` }] };
    if (user.isDeleted) return { success: false, statusCode: 400, message: "User is already temporarily deleted", data: null };

    user.isDeleted = true;
    user.deletedAt = new Date();
    user.deletedBy = adminId;
    await user.save();

    return { success: true, statusCode: 200, message: "User temporarily deleted successfully", data: null };
  } catch (error: any) {
    console.error("temporaryDeleteUserService error:", error);
    return { success: false, statusCode: 500, message: `Failed to temporarily delete user: ${error.message || "unknown error"}`, data: null };
  }
};


const permanentDeleteUserService = async (userId: string): Promise<ServiceResponse<null>> => {
  try {
    if (!userId?.trim()) return { success: false, statusCode: 400, message: "User ID is required", data: null };

    const user = await User.findOne({ _id: userId, role: ROLE.USER });
    if (!user) return { success: false, statusCode: 404, message: `No user found with ID "${userId}"`, data: null };

    await User.findByIdAndDelete(userId);
    return { success: true, statusCode: 200, message: "User permanently deleted successfully", data: null };
  } catch (error: any) {
    console.error("permanentDeleteUserService error:", error);
    return { success: false, statusCode: 500, message: `Failed to permanently delete user: ${error.message || "unknown error"}`, data: null };
  }
};


const changeAdminPasswordService = async (adminId: string, body: any): Promise<ServiceResponse<null>> => {
  try {
    const validation = changePasswordSchema.safeParse(body);
    if (!validation.success) {
      const fieldErrors = validation.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
      return { success: false, statusCode: 400, message: `Validation failed: ${fieldErrors.map((e) => e.message).join(", ")}`, data: null, errors: fieldErrors };
    }

    const { currentPassword, newPassword } = validation.data;
    const admin = await User.findOne({ _id: adminId, role: ROLE.ADMIN }).select("+password");
    if (!admin) return { success: false, statusCode: 404, message: "Admin not found", data: null };

    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) return { success: false, statusCode: 401, message: "Current password is incorrect", data: null, errors: [{ field: "currentPassword", message: "Current password is incorrect" }] };
    if (currentPassword === newPassword) return { success: false, statusCode: 400, message: "New password must be different", data: null, errors: [{ field: "newPassword", message: "New password must be different from current password" }] };

    admin.password = newPassword;
    await admin.save();

    return { success: true, statusCode: 200, message: "Password changed successfully", data: null };
  } catch (error: any) {
    console.error("changeAdminPasswordService error:", error);
    return { success: false, statusCode: 500, message: `Failed to change password: ${error.message || "unknown error"}`, data: null };
  }
};


const updateAdminProfileService = async (adminId: string, body: any): Promise<ServiceResponse<{
  id: unknown; fullName: string; email: string; bio: string | null; lastLogin: Date | null;
}>> => {
  try {
    const validation = updateProfileSchema.safeParse(body);
    if (!validation.success) {
      const fieldErrors = validation.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
      return { success: false, statusCode: 400, message: `Validation failed: ${fieldErrors.map((e) => e.message).join(", ")}`, data: null, errors: fieldErrors };
    }

    const validData = validation.data;
    const admin = await User.findOne({ _id: adminId, role: ROLE.ADMIN });
    if (!admin) return { success: false, statusCode: 404, message: "Admin not found", data: null };

    // Email uniqueness check
    if (validData.email && validData.email !== admin.email) {
      const emailTaken = await User.findOne({ email: validData.email, _id: { $ne: adminId } });
      if (emailTaken) return { success: false, statusCode: 409, message: "Email already in use", data: null, errors: [{ field: "email", message: "This email is already taken" }] };
    }

    if (validData.fullName !== undefined) admin.fullName = validData.fullName;
    if (validData.email !== undefined) admin.email = validData.email;
    if (validData.bio !== undefined) admin.bio = validData.bio ?? null;

    await admin.save();

    return {
      success: true,
      statusCode: 200,
      message: "Profile updated successfully",
      data: { id: admin._id, fullName: admin.fullName, email: admin.email, bio: admin.bio, lastLogin: admin.lastLogin },
    };
  } catch (error: any) {
    console.error("updateAdminProfileService error:", error);
    return { success: false, statusCode: 500, message: `Failed to update profile: ${error.message || "unknown error"}`, data: null };
  }
};

// ─── Add User (Customer) ──────────────────────────────────────────────────────
const addUserService = async (body: any): Promise<ServiceResponse<null>> => {
  try {
    const validation = adminAuthValidation.addUserSchema.safeParse(body);
    if (!validation.success) {
      const fieldErrors = validation.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
      return { success: false, statusCode: 400, message: `Validation failed: ${fieldErrors.map((e) => e.message).join(", ")}`, data: null, errors: fieldErrors };
    }

    const { fullName, email, password, provider } = validation.data;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return {
        success: false,
        statusCode: 409,
        message: `User with email "${email}" already exists`,
        data: null,
        errors: [{ field: "email", message: "Email already in use" }],
      };
    }

    const user = new User({
      fullName,
      email,
      password,
      provider,
      role: ROLE.USER,
      isVerified: true, // Admin-added users are verified by default
    });

    await user.save();

    return { success: true, statusCode: 201, message: "User added successfully", data: null };
  } catch (error: any) {
    console.error("addUserService error:", error);
    return { success: false, statusCode: 500, message: `Failed to add user: ${error.message || "unknown error"}`, data: null };
  }
};

// ─── Get User By ID ───────────────────────────────────────────────────────────
const getUserByIdService = async (userId: string): Promise<ServiceResponse> => {
  try {
    if (!userId?.trim()) return { success: false, statusCode: 400, message: "User ID is required", data: null };

    const user = await User.findOne({ _id: userId, role: ROLE.USER })
      .select("fullName email avatar role isVerified isDeleted deletedAt deletedBy provider lastLogin createdAt updatedAt");
    
    if (!user) return { success: false, statusCode: 404, message: `User with ID "${userId}" not found`, data: null };

    return {
      success: true,
      statusCode: 200,
      message: "User fetched successfully",
      data: {
        id: user._id, fullName: user.fullName, email: user.email, avatar: user.avatar,
        role: user.role, isVerified: user.isVerified, isDeleted: user.isDeleted,
        deletedAt: user.deletedAt, deletedBy: user.deletedBy, provider: user.provider,
        lastLogin: user.lastLogin, createdAt: user.createdAt, updatedAt: user.updatedAt,
      },
    };
  } catch (error: any) {
    console.error("getUserByIdService error:", error);
    return { success: false, statusCode: 500, message: `Failed to fetch user: ${error.message || "unknown error"}`, data: null };
  }
};

export {
  adminLoginService,
  getAllUsersService,
  temporaryDeleteUserService,
  permanentDeleteUserService,
  changeAdminPasswordService,
  updateAdminProfileService,
  addUserService,
  getUserByIdService,
};