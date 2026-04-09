import { z } from "zod";

const registerUserSchema = z
  .object({
    fullName: z.string().trim().min(2, "Full name must be at least 2 characters"),
    email: z.string().trim().email("Please provide a valid email"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Confirm password is required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const loginUserSchema = z.object({
  email: z.string().trim().email("Please provide a valid email"),
  password: z.string().min(1, "Password is required"),
});

const socialLoginSchema = z.object({
  provider: z.enum(["google", "facebook"], {
    message: "Unsupported social login provider",
  }),
  token: z.string().trim().min(1, "Token is required"),
});

const verifyEmailSchema = z.object({
  token: z.string().trim().min(1, "Verification token is required"),
});

const resendVerificationEmailSchema = z.object({
  email: z.string().trim().email("Please provide a valid email"),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Please provide a valid email"),
});

const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1, "Reset token is required"),
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Confirm password is required"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const userAuthValidation = {
  registerUserSchema,
  loginUserSchema,
  socialLoginSchema,
  verifyEmailSchema,
  resendVerificationEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};