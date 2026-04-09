import { z } from "zod";

const adminLoginSchema = z.object({
  email: z.string().trim().email("Please provide a valid email"),
  password: z.string().min(1, "Password is required"),
});

const addUserSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters"),
  email: z.string().trim().email("Please provide a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  provider: z.enum(["local", "google", "facebook"]).default("local"),
});

export const adminAuthValidation = {
  adminLoginSchema,
  addUserSchema,
};