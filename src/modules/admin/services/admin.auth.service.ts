import generateToken from "../../../utils/jwt";
import { ROLE } from "../../../utils/enums/role";
import prisma from "../../../config/prisma";
import bcrypt from "bcryptjs";
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
    const admin = await prisma.user.findFirst({
      where: { email, role: ROLE.ADMIN },
    });

    if (!admin || !admin.password) return { success: false, statusCode: 401, message: "Invalid admin email or password", data: null, errors: [{ field: "email", message: "Invalid email or password" }] };

    const isPasswordMatched = await bcrypt.compare(password, admin.password);
    if (!isPasswordMatched) return { success: false, statusCode: 401, message: "Invalid admin email or password", data: null, errors: [{ field: "password", message: "Invalid email or password" }] };

    // ── Record last login time ──
    const updatedAdmin = await prisma.user.update({
      where: { id: admin.id },
      data: { lastLogin: new Date() }
    });

    const token = generateToken({ id: admin.id, email: admin.email, role: ROLE.ADMIN });

    return {
      success: true,
      statusCode: 200,
      message: "Admin login successful",
      data: {
        admin: { id: updatedAdmin.id, fullName: updatedAdmin.fullName, email: updatedAdmin.email, bio: updatedAdmin.bio ?? null, lastLogin: updatedAdmin.lastLogin },
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
    const users = await prisma.user.findMany({
      where: { role: ROLE.USER },
      select: {
        id: true, fullName: true, email: true, avatar: true,
        role: true, isVerified: true, isDeleted: true,
        deletionRequested: true, deletedAt: true, deletedBy: true,
        provider: true, createdAt: true, updatedAt: true
      },
      orderBy: { createdAt: "desc" }
    });

    return {
      success: true,
      statusCode: 200,
      message: "Users fetched successfully",
      data: users.map(u => ({ ...u })), // Return mapped users directly
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

    const user = await prisma.user.findFirst({ where: { id: userId, role: ROLE.USER } });
    if (!user) return { success: false, statusCode: 404, message: `No user found with ID "${userId}"`, data: null, errors: [{ field: "userId", message: `No user found with ID "${userId}"` }] };
    if (user.isDeleted) return { success: false, statusCode: 400, message: "User is already temporarily deleted", data: null };

    await prisma.user.update({
      where: { id: userId },
      data: { isDeleted: true, deletedAt: new Date(), deletedBy: adminId }
    });

    return { success: true, statusCode: 200, message: "User temporarily deleted successfully", data: null };
  } catch (error: any) {
    console.error("temporaryDeleteUserService error:", error);
    return { success: false, statusCode: 500, message: `Failed to temporarily delete user: ${error.message || "unknown error"}`, data: null };
  }
};


const permanentDeleteUserService = async (userId: string): Promise<ServiceResponse<null>> => {
  try {
    if (!userId?.trim()) return { success: false, statusCode: 400, message: "User ID is required", data: null };

    const user = await prisma.user.findFirst({ where: { id: userId, role: ROLE.USER } });
    if (!user) return { success: false, statusCode: 404, message: `No user found with ID "${userId}"`, data: null };

    await prisma.user.delete({ where: { id: userId } });
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
    const admin = await prisma.user.findFirst({ where: { id: adminId, role: ROLE.ADMIN } });
    if (!admin || !admin.password) return { success: false, statusCode: 404, message: "Admin not found", data: null };

    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) return { success: false, statusCode: 401, message: "Current password is incorrect", data: null, errors: [{ field: "currentPassword", message: "Current password is incorrect" }] };
    if (currentPassword === newPassword) return { success: false, statusCode: 400, message: "New password must be different", data: null, errors: [{ field: "newPassword", message: "New password must be different from current password" }] };

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: adminId }, data: { password: hashedPassword } });

    return { success: true, statusCode: 200, message: "Password changed successfully", data: null };
  } catch (error: any) {
    console.error("changeAdminPasswordService error:", error);
    return { success: false, statusCode: 500, message: `Failed to change password: ${error.message || "unknown error"}`, data: null };
  }
};


const updateAdminProfileService = async (adminId: string, body: any): Promise<ServiceResponse<{
  id: unknown; fullName: string; email: string; bio: string | null; lastLogin: Date | null; avatar: string | null;
}>> => {
  try {
    const validation = updateProfileSchema.safeParse(body);
    if (!validation.success) {
      const fieldErrors = validation.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
      return { success: false, statusCode: 400, message: `Validation failed: ${fieldErrors.map((e) => e.message).join(", ")}`, data: null, errors: fieldErrors };
    }

    const validData = validation.data;
    const admin = await prisma.user.findFirst({ where: { id: adminId, role: ROLE.ADMIN } });
    if (!admin) return { success: false, statusCode: 404, message: "Admin not found", data: null };

    // Email uniqueness check
    if (validData.email && validData.email !== admin.email) {
      const emailTaken = await prisma.user.findFirst({ where: { email: validData.email, id: { not: adminId } } });
      if (emailTaken) return { success: false, statusCode: 409, message: "Email already in use", data: null, errors: [{ field: "email", message: "This email is already taken" }] };
    }

    const updatedAdmin = await prisma.user.update({
      where: { id: adminId },
      data: {
        fullName: validData.fullName !== undefined ? validData.fullName : admin.fullName,
        email: validData.email !== undefined ? validData.email : admin.email,
        bio: validData.bio !== undefined ? validData.bio : admin.bio,
        avatar: body.avatar !== undefined ? body.avatar : admin.avatar,
      }
    });

    return {
      success: true,
      statusCode: 200,
      message: "Profile updated successfully",
      data: { id: updatedAdmin.id, fullName: updatedAdmin.fullName, email: updatedAdmin.email, bio: updatedAdmin.bio, lastLogin: updatedAdmin.lastLogin, avatar: updatedAdmin.avatar },
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

    const existingUser = await prisma.user.findFirst({ where: { email } });
    if (existingUser) {
      return {
        success: false,
        statusCode: 409,
        message: `User with email "${email}" already exists`,
        data: null,
        errors: [{ field: "email", message: "Email already in use" }],
      };
    }

    const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

    await prisma.user.create({
      data: {
        fullName,
        email,
        password: hashedPassword,
        provider,
        role: ROLE.USER,
        isVerified: true, // Admin-added users are verified by default
      }
    });

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

    const user = await prisma.user.findFirst({ 
      where: { id: userId, role: ROLE.USER },
      select: {
        id: true, fullName: true, email: true, avatar: true,
        role: true, isVerified: true, isDeleted: true,
        deletionRequested: true, deletedAt: true, deletedBy: true,
        provider: true, lastLogin: true, createdAt: true, updatedAt: true
      }
    });
    
    if (!user) return { success: false, statusCode: 404, message: `User with ID "${userId}" not found`, data: null };

    return {
      success: true,
      statusCode: 200,
      message: "User fetched successfully",
      data: { ...user },
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