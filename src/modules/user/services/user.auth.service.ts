import crypto from "crypto";
import bcrypt from "bcryptjs";
import mailTransporter from "../../../config/mail";
import generateToken from "../../../utils/jwt";
import generateVerificationToken from "../../../utils/token";
import verifyGoogleToken from "../../../utils/google";
import { verifyFacebookToken } from "../../../utils/facebook";
import { notifyAdmin } from "../../../utils/notification.utils";
import { ROLE } from "../../../utils/enums/role";
import { userAuthValidation } from "../validations/user.auth.validation";
import prisma from "../../../config/prisma";

type FieldError = {
  field: string;
  message: string;
};

type ServiceResponse<T = unknown> = {
  success: boolean;
  statusCode: number;
  message: string;
  data: T | null;
  errors?: FieldError[];
};

const emailVerificationExpiryMinutes = Number(
  process.env.EMAIL_VERIFICATION_EXPIRES_MINUTES || 60
);

const r9yMnTm4NSzvG9rrwjM2ec8xZgh1cafXH8 = Number(
  process.env.RESET_PASSWORD_EXPIRES_MINUTES || 10
);

const sendVerificationEmail = async (
  email: string,
  token: string
): Promise<ServiceResponse<null>> => {
  try {
    const verificationLink = `${process.env.CLIENT_URL}/auth/verify-email?token=${token}`;

    await mailTransporter.sendMail({
      from: process.env.MAIL_FROM,
      to: email,
      subject: "Verify Your Email",
      html: `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9fafb;">
    <div style="background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb; text-align: center;">
      <h2 style="margin: 0 0 16px; color: #111827;">Email Verification</h2>
      <p style="margin: 0 0 24px; color: #4b5563; font-size: 15px; line-height: 1.6;">
        Please verify your email address by clicking the button below.
      </p>
      <a href="${verificationLink}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;">
  Verify Email
</a>
    </div>
  </div>
`,
    });

    return {
      success: true,
      statusCode: 200,
      message: "Verification email sent successfully",
      data: null,
    };
  } catch (error: any) {
    console.error("sendVerificationEmail error:", error);
    return {
      success: false,
      statusCode: 500,
      message: `Failed to send verification email: ${error.message || "unknown error"}`,
      data: null,
    };
  }
};

const registerUserService = async (
  body: any
): Promise<ServiceResponse> => {
  try {
    const validation = userAuthValidation.registerUserSchema.safeParse(body);

    if (!validation.success) {
      const fieldErrors = validation.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      return {
        success: false,
        statusCode: 400,
        message: `Validation failed: ${fieldErrors.map((e) => e.message).join(", ")}`,
        data: null,
        errors: fieldErrors,
      };
    }

    const { fullName, email, password } = validation.data;
    const avatar = body.avatar || null;

    const existingUser = await prisma.user.findFirst({ where: { email } });

    if (existingUser && !existingUser.isVerified) {
      return {
        success: false,
        statusCode: 409,
        message: "Email already registered but not verified: please check your inbox and verify your email",
        data: null,
        errors: [{ field: "email", message: "This email is already registered. Please verify your email first" }],
      };
    }

    if (existingUser && existingUser.isVerified) {
      return {
        success: false,
        statusCode: 409,
        message: "User already exists: an account with this email already exists",
        data: null,
        errors: [{ field: "email", message: "An account with this email already exists" }],
      };
    }

    const verificationToken = generateVerificationToken();
    const verificationExpires = new Date(
      Date.now() + emailVerificationExpiryMinutes * 60 * 1000
    );

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        password: hashedPassword,
        avatar: avatar || null,
        role: "user",
        provider: "local",
        providerId: null,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      },
    });

    // Unified Admin Alert (Registration)
    await notifyAdmin({
      title: "New User Registration",
      message: `${user.fullName} (${user.email}) just created an account.`,
      type: "info",
      relatedId: user.id.toString(),
      relatedModel: "User",
      category: "customerNotifications",
    });

    const emailResponse = await sendVerificationEmail(user.email, verificationToken);

    if (!emailResponse.success) {
      return {
        success: false,
        statusCode: 500,
        message: emailResponse.message,
        data: null,
      };
    }

    return {
      success: true,
      statusCode: 201,
      message: "User registered successfully. Please verify your email.",
      data: {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          avatar: user.avatar,
          isVerified: user.isVerified,
          provider: user.provider,
        },
      },
    };
  } catch (error: any) {
    console.error("registerUserService error:", error);
    return {
      success: false,
      statusCode: 500,
      message: `Failed to create account: ${error.message || "unknown error"}`,
      data: null,
    };
  }
};

const verifyEmailService = async (
  token: string
): Promise<ServiceResponse> => {
  try {
    if (!token || token.trim() === "") {
      return {
        success: false,
        statusCode: 400,
        message: "Verification token is required",
        data: null,
        errors: [{ field: "token", message: "Verification token is required in URL params" }],
      };
    }

    const user = await prisma.user.findFirst({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      return {
        success: false,
        statusCode: 400,
        message: "Invalid verification token: no user found with this token",
        data: null,
        errors: [{ field: "token", message: "This verification token is invalid or does not exist" }],
      };
    }

    if (user.isVerified) {
      return {
        success: false,
        statusCode: 400,
        message: "Email already verified: this verification token has already been used",
        data: null,
        errors: [{ field: "token", message: "This email is already verified" }],
      };
    }

    if (!user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      return {
        success: false,
        statusCode: 400,
        message: "Verification token has expired: please request a new verification email",
        data: null,
        errors: [{ field: "token", message: "This token has expired. Please request a new one" }],
      };
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    return {
      success: true,
      statusCode: 200,
      message: "Email verified successfully",
      data: {
        user: {
          id: updatedUser.id,
          fullName: updatedUser.fullName,
          email: updatedUser.email,
          avatar: updatedUser.avatar,
          isVerified: updatedUser.isVerified,
          provider: updatedUser.provider,
        },
      },
    };
  } catch (error: any) {
    console.error("verifyEmailService error:", error);
    return {
      success: false,
      statusCode: 500,
      message: `Failed to verify email: ${error.message || "unknown error"}`,
      data: null,
    };
  }
};

const resendVerificationEmailService = async (
  body: any
): Promise<ServiceResponse<null>> => {
  try {
    const validation = userAuthValidation.resendVerificationEmailSchema.safeParse(body);

    if (!validation.success) {
      const fieldErrors = validation.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      return {
        success: false,
        statusCode: 400,
        message: `Validation failed: ${fieldErrors.map((e) => e.message).join(", ")}`,
        data: null,
        errors: fieldErrors,
      };
    }

    const { email } = validation.data;

    const user = await prisma.user.findFirst({ where: { email } });

    if (!user) {
      return {
        success: false,
        statusCode: 404,
        message: `User not found: no account exists with email "${email}"`,
        data: null,
        errors: [{ field: "email", message: `No account found with email "${email}"` }],
      };
    }

    if (user.isVerified) {
      return {
        success: false,
        statusCode: 400,
        message: "Email is already verified: no verification needed",
        data: null,
        errors: [{ field: "email", message: "This email is already verified" }],
      };
    }

    const verificationToken = generateVerificationToken();
    const verificationExpires = new Date(
      Date.now() + emailVerificationExpiryMinutes * 60 * 1000
    );

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      },
    });

    const emailResponse = await sendVerificationEmail(email, verificationToken);

    if (!emailResponse.success) {
      return {
        success: false,
        statusCode: 500,
        message: emailResponse.message,
        data: null,
      };
    }

    return {
      success: true,
      statusCode: 200,
      message: "Verification email resent successfully",
      data: null,
    };
  } catch (error: any) {
    console.error("resendVerificationEmailService error:", error);
    return {
      success: false,
      statusCode: 500,
      message: `Failed to resend verification email: ${error.message || "unknown error"}`,
      data: null,
    };
  }
};

const loginUserService = async (
  body: any
): Promise<ServiceResponse> => {
  try {
    const validation = userAuthValidation.loginUserSchema.safeParse(body);

    if (!validation.success) {
      const fieldErrors = validation.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      return {
        success: false,
        statusCode: 400,
        message: `Validation failed: ${fieldErrors.map((e) => e.message).join(", ")}`,
        data: null,
        errors: fieldErrors,
      };
    }

    const { email, password } = validation.data;

    const user = await prisma.user.findFirst({ where: { email } });

    if (!user) {
      return {
        success: false,
        statusCode: 401,
        message: "Invalid email or password: no account found with this email",
        data: null,
        errors: [{ field: "email", message: "No account found with this email" }],
      };
    }

    if (!user.password) {
      return {
        success: false,
        statusCode: 401,
        message: "This account uses social login. Please login with Google or Facebook.",
        data: null,
      };
    }

    const isPasswordMatched = await bcrypt.compare(password, user.password);

    if (!isPasswordMatched) {
      return {
        success: false,
        statusCode: 401,
        message: "Invalid email or password: incorrect password",
        data: null,
        errors: [{ field: "password", message: "Incorrect password" }],
      };
    }

    if (!user.isVerified) {
      return {
        success: false,
        statusCode: 403,
        message: "Please verify your email first",
        data: null,
        errors: [{ field: "email", message: "Please verify your email before logging in" }],
      };
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: ROLE.USER,
    });

    return {
      success: true,
      statusCode: 200,
      message: "Login successful",
      data: {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          avatar: user.avatar,
          isVerified: user.isVerified,
          provider: user.provider,
        },
        token,
      },
    };
  } catch (error: any) {
    console.error("loginUserService error:", error);
    return {
      success: false,
      statusCode: 500,
      message: `Login failed: ${error.message || "unknown error"}`,
      data: null,
    };
  }
};

const socialLoginService = async (
  body: any
): Promise<ServiceResponse> => {
  try {
    const validation = userAuthValidation.socialLoginSchema.safeParse(body);

    if (!validation.success) {
      const fieldErrors = validation.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      return {
        success: false,
        statusCode: 400,
        message: `Validation failed: ${fieldErrors.map((e) => e.message).join(", ")}`,
        data: null,
        errors: fieldErrors,
      };
    }

    const { provider, token } = validation.data;

    let socialUser: any;

    if (provider === "google") {
      socialUser = await verifyGoogleToken(token);
    } else if (provider === "facebook") {
      socialUser = await verifyFacebookToken(token);
    } else {
      return {
        success: false,
        statusCode: 400,
        message: `Unsupported social login provider: "${provider}" is not supported`,
        data: null,
        errors: [{ field: "provider", message: `"${provider}" is not a supported provider. Use "google" or "facebook"` }],
      };
    }

    const existingUser = await prisma.user.findFirst({ where: { email: socialUser.email } });

    if (existingUser && existingUser.provider === "local") {
      return {
        success: false,
        statusCode: 409,
        message: "This email is already registered with email and password: please login with your password instead",
        data: null,
        errors: [{ field: "email", message: "This email uses password login. Please use email/password to login" }],
      };
    }

    let user = existingUser;

    if (!user) {
      user = await prisma.user.create({
        data: {
          fullName: socialUser.fullName,
          email: socialUser.email,
          avatar: null,
          role: "user",
          provider,
          providerId: socialUser.providerId,
          isVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
        },
      });

      // Unified Admin Alert (Social Registration)
      await notifyAdmin({
        title: "New User Registration",
        message: `${socialUser.fullName} (${socialUser.email}) just registered via ${provider}.`,
        type: "info",
        relatedId: user.id.toString(),
        relatedModel: "User",
        category: "customerNotifications",
      });
    }

    const authToken = generateToken({
      id: user.id,
      email: user.email,
      role: ROLE.USER,
    });

    return {
      success: true,
      statusCode: 200,
      message: "Social login successful",
      data: {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          avatar: user.avatar,
          isVerified: user.isVerified,
          provider: user.provider,
        },
        token: authToken,
      },
    };
  } catch (error: any) {
    console.error("socialLoginService error:", error);
    return {
      success: false,
      statusCode: 500,
      message: `Social login failed: ${error.message || "unknown error"}`,
      data: null,
    };
  }
};

const forgotPasswordService = async (
  body: any
): Promise<ServiceResponse<null>> => {
  try {
    const validation = userAuthValidation.forgotPasswordSchema.safeParse(body);

    if (!validation.success) {
      const fieldErrors = validation.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      return {
        success: false,
        statusCode: 400,
        message: `Validation failed: ${fieldErrors.map((e) => e.message).join(", ")}`,
        data: null,
        errors: fieldErrors,
      };
    }

    const { email } = validation.data;

    const user = await prisma.user.findFirst({ where: { email } });

    if (!user) {
      return {
        success: false,
        statusCode: 404,
        message: `User not found: no account exists with email "${email}"`,
        data: null,
        errors: [{ field: "email", message: `No account found with email "${email}"` }],
      };
    }

    if (
      user.resetPasswordToken &&
      user.resetPasswordExpires &&
      user.resetPasswordExpires > new Date()
    ) {
      return {
        success: false,
        statusCode: 400,
        message: "Reset password email already sent: please use the existing link or wait for it to expire",
        data: null,
        errors: [{ field: "email", message: "A reset email was already sent. Check your inbox or wait for it to expire" }],
      };
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpires: new Date(
          Date.now() + r9yMnTm4NSzvG9rrwjM2ec8xZgh1cafXH8 * 60 * 1000
        ),
      },
    });

    const resetLink = `${process.env.CLIENT_URL}/auth/reset-password?token=${resetToken}`;

    await mailTransporter.sendMail({
      from: process.env.MAIL_FROM,
      to: email,
      subject: "Reset Your Password",
      html: `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9fafb;">
    <div style="background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb; text-align: center;">
      <h2 style="margin: 0 0 16px; color: #111827;">Reset Your Password</h2>
      <p style="margin: 0 0 24px; color: #4b5563; font-size: 15px; line-height: 1.6;">
        Click the button below to reset your password.
      </p>
      <a
        href="${resetLink}"
        style="display: inline-block; padding: 12px 24px; background: #dc2626; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;"
      >
        Reset Password
      </a>
      <p style="margin: 24px 0 0; color: #6b7280; font-size: 13px;">
        This link will expire in ${r9yMnTm4NSzvG9rrwjM2ec8xZgh1cafXH8} minutes.
      </p>
    </div>
  </div>
`,
    });

    return {
      success: true,
      statusCode: 200,
      message: "Password reset email sent successfully",
      data: null,
    };
  } catch (error: any) {
    console.error("forgotPasswordService error:", error);
    return {
      success: false,
      statusCode: 500,
      message: `Failed to send reset password email: ${error.message || "unknown error"}`,
      data: null,
    };
  }
};

const resetPasswordService = async (
  token: string,
  body: any
): Promise<ServiceResponse<null>> => {
  try {
    if (!token || token.trim() === "") {
      return {
        success: false,
        statusCode: 400,
        message: "Reset token is required",
        data: null,
        errors: [{ field: "token", message: "Reset token is required in URL params" }],
      };
    }

    const validation = userAuthValidation.resetPasswordSchema.safeParse({
      token,
      newPassword: body.password || body.newPassword,
      confirmPassword: body.confirmPassword || body.password,
    });

    if (!validation.success) {
      const fieldErrors = validation.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      return {
        success: false,
        statusCode: 400,
        message: `Validation failed: ${fieldErrors.map((e) => e.message).join(", ")}`,
        data: null,
        errors: fieldErrors,
      };
    }

    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return {
        success: false,
        statusCode: 400,
        message: "Invalid or expired reset token: this link is no longer valid",
        data: null,
        errors: [{ field: "token", message: "This reset link is invalid or has expired. Please request a new one" }],
      };
    }

    const hashedPassword = await bcrypt.hash(validation.data.newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    return {
      success: true,
      statusCode: 200,
      message: "Password reset successful",
      data: null,
    };
  } catch (error: any) {
    console.error("resetPasswordService error:", error);
    return {
      success: false,
      statusCode: 500,
      message: `Failed to reset password: ${error.message || "unknown error"}`,
      data: null,
    };
  }
};

const requestAccountDeletionService = async (
  userId: string
): Promise<ServiceResponse<null>> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return {
        success: false,
        statusCode: 404,
        message: "User not found",
        data: null,
        errors: [{ field: "userId", message: "User not found" }],
      };
    }

    if (user.deletionRequested) {
      return {
        success: false,
        statusCode: 400,
        message: "Deletion already requested",
        data: null,
        errors: [{ field: "account", message: "Account deletion already requested" }],
      };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { deletionRequested: true },
    });

    // Unified Admin Alert (Deletion Request)
    await notifyAdmin({
      title: "Account Deletion Requested",
      message: `${user.fullName} (${user.email}) requested to delete their account.`,
      type: "error",
      relatedId: user.id.toString(),
      relatedModel: "User",
      category: "customerNotifications",
    });

    return {
      success: true,
      statusCode: 200,
      message: "Account deletion requested successfully. Pending admin approval.",
      data: null,
    };
  } catch (error: any) {
    console.error("requestAccountDeletionService error:", error);
    return {
      success: false,
      statusCode: 500,
      message: `Failed to request account deletion: ${error.message || "unknown error"}`,
      data: null,
    };
  }
};

const getEmailPreferencesService = async (
  userId: string
): Promise<ServiceResponse> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        prefOrderUpdates: true,
        prefPromotionalEmails: true,
        prefProductRecommendations: true,
      },
    });
    if (!user) {
      return { success: false, statusCode: 404, message: "User not found", data: null };
    }
    return {
      success: true,
      statusCode: 200,
      message: "Email preferences fetched",
      data: {
        orderUpdates: user.prefOrderUpdates,
        promotionalEmails: user.prefPromotionalEmails,
        productRecommendations: user.prefProductRecommendations,
      },
    };
  } catch (error: any) {
    return { success: false, statusCode: 500, message: `Failed: ${error.message}`, data: null };
  }
};

const updateEmailPreferencesService = async (
  userId: string,
  prefs: { orderUpdates?: boolean; promotionalEmails?: boolean; productRecommendations?: boolean }
): Promise<ServiceResponse> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return { success: false, statusCode: 404, message: "User not found", data: null };
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        prefOrderUpdates: prefs.orderUpdates !== undefined ? prefs.orderUpdates : user.prefOrderUpdates,
        prefPromotionalEmails: prefs.promotionalEmails !== undefined ? prefs.promotionalEmails : user.prefPromotionalEmails,
        prefProductRecommendations: prefs.productRecommendations !== undefined ? prefs.productRecommendations : user.prefProductRecommendations,
      },
    });

    return {
      success: true,
      statusCode: 200,
      message: "Email preferences updated",
      data: {
        orderUpdates: updated.prefOrderUpdates,
        promotionalEmails: updated.prefPromotionalEmails,
        productRecommendations: updated.prefProductRecommendations,
      },
    };
  } catch (error: any) {
    return { success: false, statusCode: 500, message: `Failed: ${error.message}`, data: null };
  }
};

const updateUserProfileService = async (userId: string, body: any): Promise<ServiceResponse<any>> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, statusCode: 404, message: "User not found", data: null };

    // Email check if changed
    if (body.email && body.email !== user.email) {
      const existing = await prisma.user.findFirst({ where: { email: body.email, id: { not: userId } } });
      if (existing) {
        return { success: false, statusCode: 409, message: "Email is already taken", data: null, errors: [{ field: "email", message: "Email is already taken" }] };
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: body.fullName !== undefined ? body.fullName : user.fullName,
        email: body.email !== undefined ? body.email : user.email,
        bio: body.bio !== undefined ? body.bio : user.bio,
        phone: body.phone !== undefined ? body.phone : user.phone,
        dateOfBirth: body.dateOfBirth !== undefined ? body.dateOfBirth : user.dateOfBirth,
        avatar: body.avatar !== undefined ? body.avatar : user.avatar,
      },
    });

    return {
      success: true,
      statusCode: 200,
      message: "Profile updated successfully",
      data: {
        id: updated.id,
        fullName: updated.fullName,
        email: updated.email,
        avatar: updated.avatar,
        bio: updated.bio,
        phone: updated.phone,
        dateOfBirth: updated.dateOfBirth,
      },
    };
  } catch (error: any) {
    return { success: false, statusCode: 500, message: `Failed to update profile: ${error.message}`, data: null };
  }
};

export {
  registerUserService,
  verifyEmailService,
  resendVerificationEmailService,
  loginUserService,
  socialLoginService,
  forgotPasswordService,
  resetPasswordService,
  requestAccountDeletionService,
  getEmailPreferencesService,
  updateEmailPreferencesService,
  updateUserProfileService,
};