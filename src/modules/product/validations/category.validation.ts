import { z } from "zod";

const createCategorySchema = z.object({
  name: z.string().trim().min(2, "Category name must be at least 2 characters"),
  slug: z.string().trim().min(1, "Slug must not be empty").optional(),
  description: z.string().trim().optional(),
  image: z.string().trim().optional(),
});

const updateCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Category name must be at least 2 characters")
    .optional(),
  slug: z.string().trim().min(1, "Slug must not be empty").optional(),
  description: z.string().trim().optional(),
  image: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

export const categoryValidation = {
  createCategorySchema,
  updateCategorySchema,
};