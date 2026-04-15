import { Request, Response, NextFunction } from "express";
import prisma from "../../../config/prisma";
import { buildProductDetail } from "../../product/services/product.service";
import sendResponse, { createError } from "../../../utils/apiResponse";

// Helper to get or create wishlist
const getOrCreateWishlistId = async (userId: string): Promise<string> => {
  let wishlist = await prisma.wishlist.findUnique({ where: { userId } });
  if (!wishlist) {
    wishlist = await prisma.wishlist.create({ data: { userId } });
  }
  return wishlist.id;
};

export const addWishlist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).authUser?.id;
    const productId = req.body.productId;

    if (!productId || typeof productId !== "string") {
      return next(createError({ statusCode: 400, message: "Valid Product ID string is required" }));
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return next(createError({ statusCode: 404, message: "Product not found" }));
    }

    const wishlistId = await getOrCreateWishlistId(userId);

    // Check if already in wishlist
    const existing = await prisma.wishlistItem.findFirst({
      where: { wishlistId, productId },
    });

    if (existing) {
      const wishlistItems = await prisma.wishlistItem.findMany({
        where: { wishlistId },
      });
      return sendResponse(res, { statusCode: 200, message: "Product already in wishlist", data: { products: wishlistItems } });
    }

    await prisma.wishlistItem.create({
      data: { wishlistId, productId },
    });

    const wishlistItems = await prisma.wishlistItem.findMany({
      where: { wishlistId },
    });
    return sendResponse(res, { statusCode: 201, message: "Product added to wishlist", data: { products: wishlistItems } });
  } catch (error) {
    next(error);
  }
};

export const removeWishlist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).authUser?.id;
    const productId = req.params.productId;

    if (!productId || typeof productId !== "string") {
      return next(createError({ statusCode: 400, message: "Valid Product ID string is required" }));
    }

    const wishlist = await prisma.wishlist.findUnique({ where: { userId } });
    if (wishlist) {
      await prisma.wishlistItem.deleteMany({
        where: { wishlistId: wishlist.id, productId },
      });
    }

    const wishlistId = wishlist ? wishlist.id : "";
    const wishlistItems = wishlistId 
      ? await prisma.wishlistItem.findMany({ where: { wishlistId } })
      : [];
      
    return sendResponse(res, { statusCode: 200, message: "Product removed from wishlist", data: { products: wishlistItems } });
  } catch (error) {
    next(error);
  }
};

export const getWishlist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).authUser?.id;

    const wishlist = await prisma.wishlist.findUnique({
      where: { userId },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    if (!wishlist || wishlist.items.length === 0) {
      return sendResponse(res, { statusCode: 200, message: "Wishlist is empty", data: { products: [] } });
    }

    const productsWithDetails = await Promise.all(
      wishlist.items.map(async (item) => {
        const detail = await buildProductDetail(item.product);
        return { ...detail, addedAt: item.addedAt };
      })
    );

    return sendResponse(res, {
      statusCode: 200,
      message: "Wishlist fetched successfully",
      data: { products: productsWithDetails },
    });
  } catch (error) {
    next(error);
  }
};

export const clearWishlist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).authUser?.id;

    const wishlist = await prisma.wishlist.findUnique({ where: { userId } });
    if (wishlist) {
      await prisma.wishlistItem.deleteMany({ where: { wishlistId: wishlist.id } });
    }

    return sendResponse(res, { statusCode: 200, message: "Wishlist cleared successfully", data: { products: [] } });
  } catch (error) {
    next(error);
  }
};

export const syncWishlist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).authUser?.id || "";
    const { productIds } = req.body;

    if (!Array.isArray(productIds)) {
      return next(createError({ statusCode: 400, message: "productIds must be an array" }));
    }

    const validIds = (productIds as string[]).filter((id) => typeof id === "string" && id.trim());

    // Check which ones actually exist in DB
    const existingProducts = await prisma.product.findMany({
      where: { id: { in: validIds } },
      select: { id: true },
    });
    const existingIds = existingProducts.map((p) => p.id);

    const wishlistId = await getOrCreateWishlistId(userId);

    // Get current items in this wishlist
    const currentItems = await prisma.wishlistItem.findMany({
      where: { wishlistId },
      select: { productId: true },
    });
    const currentProductIds = currentItems.map((item) => item.productId);

    // Merge without duplicates
    const newIds = existingIds.filter((id) => !currentProductIds.includes(id));

    if (newIds.length > 0) {
      await prisma.wishlistItem.createMany({
        data: newIds.map((productId) => ({ wishlistId, productId })),
        skipDuplicates: true,
      });
    }

    const updatedItems = await prisma.wishlistItem.findMany({ where: { wishlistId } });
    return sendResponse(res, {
      statusCode: 200,
      message: "Wishlist synced successfully",
      data: { products: updatedItems },
    });
  } catch (error) {
    next(error);
  }
};
