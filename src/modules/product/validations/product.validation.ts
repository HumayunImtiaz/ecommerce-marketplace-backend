import { z } from "zod";

const variantSchema = z.object({
  size: z.string().trim().min(1, "Size is required"),
  color: z.string().trim().min(1, "Color is required"),
  price: z.union([z.number().min(0, "Variant price must be 0 or more"), z.null()]).optional(),
  stock: z.number().int().min(0, "Stock must be 0 or more").optional(),
});

const createProductSchema = z.object({
  name: z.string().trim().min(2, "Product name must be at least 2 characters"),
  slug: z.string().trim().min(1, "Slug must not be empty").optional(),
  description: z.string().trim().optional(),
  price: z.number().min(0, "Price must be 0 or more"),
  comparePrice: z.union([z.number().min(0, "Compare price must be 0 or more"), z.null()]).optional(),
  sku: z.string().trim().min(1, "SKU is required"),
  categoryId: z.string().trim().min(1, "Category is required"),
  tags: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
  features: z.array(z.string()).optional(),
  isFeatured: z.boolean().optional(),
  variants: z.array(variantSchema).optional(),
});

const updateProductSchema = z.object({
  name: z.string().trim().min(2, "Product name must be at least 2 characters").optional(),
  slug: z.string().trim().min(1, "Slug must not be empty").optional(),
  description: z.union([z.string().trim(), z.null()]).optional(),
  price: z.number().min(0, "Price must be 0 or more").optional(),
  comparePrice: z.union([z.number().min(0, "Compare price must be 0 or more"), z.null()]).optional(),
  sku: z.string().trim().min(1, "SKU is required").optional(),
  categoryId: z.string().trim().min(1, "Category is required").optional(),
  tags: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
  features: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  variants: z.array(variantSchema).optional(),
});

export const productValidation = {
  createProductSchema,
  updateProductSchema,
};