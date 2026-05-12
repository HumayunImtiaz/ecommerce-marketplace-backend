import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import prisma from "../../prisma/client"; // Path assuming you have a prisma client export
import { UserRole } from "../utils/enums/role";

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

export const CreateProductSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().min(10, "Description is too short"),
  price: z.number().positive(),
  comparePrice: z.number().optional(),
  category: z.string(),
  images: z.array(z.string()).min(1, "At least one image is required"),
  totalStock: z.number().int().nonnegative(),
  variants: z.array(z.object({
    color: z.string(),
    size: z.string(),
    price: z.number().optional(),
    quantity: z.number().int()
  })).optional()
});

export const UpdateProductSchema = CreateProductSchema.partial();

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"])
});

// ─── Utility Functions ───────────────────────────────────────────────────────

/**
 * Higher Order Function equivalent for Express Middleware
 * Ensures user is an APPROVED VENDOR and injects vendorId
 */
export const authenticateVendor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).authUser; // Provided by main auth middleware
    
    if (!user || user.role !== "VENDOR") {
      return res.status(403).json({ success: false, message: "Forbidden: Vendor access required" });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { userId: user.id },
      select: { id: true, status: true }
    });

    if (!vendor || vendor.status !== "APPROVED") {
      return res.status(403).json({ success: false, message: "Forbidden: Vendor account is not approved" });
    }

    // Inject vendorId into request - NEVER take from body
    (req as any).vendorId = vendor.id;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Asserts that the vendor owns the product
 */
export const assertVendorOwnsProduct = async (productId: string, vendorId: string) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { vendorId: true }
  });

  if (!product || product.vendorId !== vendorId) {
    const error = new Error("Forbidden: You do not own this product");
    (error as any).statusCode = 403;
    throw error;
  }
  return true;
};

/**
 * Asserts that the vendor owns at least one item in the order
 */
export const assertVendorOwnsOrder = async (orderId: string, vendorId: string) => {
  // Check if order contains any product belonging to this vendor
  // Assuming Order has OrderItems or similar relation. 
  // Based on your schema, we check products in the order.
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      items: {
        some: {
          product: {
            vendorId: vendorId
          }
        }
      }
    }
  });

  if (!order) {
    const error = new Error("Forbidden: This order does not belong to your store items");
    (error as any).statusCode = 403;
    throw error;
  }
  return true;
};
