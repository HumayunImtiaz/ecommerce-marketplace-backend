import { Request, Response, NextFunction } from "express";
import Wishlist from "../models/wishlist.model";
import Product from "../../product/models/product.model";
import { buildProductDetail } from "../../product/services/product.service";
import sendResponse, { createError } from "../../../utils/apiResponse";
import mongoose from "mongoose";

// Helper to find or create wishlist for user
const getOrCreateWishlist = async (userId: string) => {
  let wishlist = await Wishlist.findOne({ userId });
  if (!wishlist) {
    wishlist = new Wishlist({ userId, products: [] });
    await wishlist.save();
  }
  return wishlist;
};

export const addWishlist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).authUser._id;
    const productId = req.body.productId;

    if (!productId || typeof productId !== "string" || !mongoose.Types.ObjectId.isValid(productId)) {
      return next(createError({ statusCode: 400, message: "Valid Product ID string is required" }));
    }

    // Validate product existence
    const product = await Product.findById(productId);
    if (!product) {
      return next(createError({ statusCode: 404, message: "Product not found" }));
    }

    const wishlist = await getOrCreateWishlist(userId);

    // Check if already in wishlist
    const isPresent = wishlist.products.some(p => p.productId.toString() === productId);
    if (isPresent) {
      return sendResponse(res, { statusCode: 200, message: "Product already in wishlist", data: wishlist });
    }

    wishlist.products.push({ 
      productId: new mongoose.Types.ObjectId(productId) as any, 
      addedAt: new Date() 
    });
    await wishlist.save();

    return sendResponse(res, { statusCode: 201, message: "Product added to wishlist", data: wishlist });
  } catch (error) {
    next(error);
  }
};

export const removeWishlist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).authUser._id;
    const { productId } = req.params;

    if (!productId || typeof productId !== "string" || !mongoose.Types.ObjectId.isValid(productId)) {
      return next(createError({ statusCode: 400, message: "Valid Product ID string is required" }));
    }

    const wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      return next(createError({ statusCode: 404, message: "Wishlist not found" }));
    }

    wishlist.products = wishlist.products.filter(p => p.productId.toString() !== productId);
    await wishlist.save();

    return sendResponse(res, { statusCode: 200, message: "Product removed from wishlist", data: wishlist });
  } catch (error) {
    next(error);
  }
};

export const getWishlist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).authUser._id;
    const wishlist = await Wishlist.findOne({ userId }).populate({
      path: "products.productId",
      select: "name slug price images avgRating reviewCount isFeatured description isActive"
    });

    if (!wishlist) {
      return sendResponse(res, { statusCode: 200, message: "Wishlist is empty", data: { products: [] } });
    }

    // Fetch full product details for each item to ensure stock and other computed fields are included
    const productsWithDetails = await Promise.all(
      wishlist.products
        .filter(p => p.productId !== null)
        .map(p => buildProductDetail(p.productId))
    );
    
    // Add addedAt back to the mapped product objects
    const finalProducts = productsWithDetails.map((pd, index) => {
      const originalProduct = wishlist.products.filter(p => p.productId !== null)[index];
      return {
        ...pd,
        addedAt: originalProduct.addedAt
      };
    });

    return sendResponse(res, { 
      statusCode: 200, 
      message: "Wishlist fetched successfully", 
      data: { products: finalProducts } 
    });
  } catch (error) {
    next(error);
  }
};

export const clearWishlist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).authUser._id;
    const wishlist = await Wishlist.findOne({ userId });
    
    if (wishlist) {
      wishlist.products = [];
      await wishlist.save();
    }

    return sendResponse(res, { statusCode: 200, message: "Wishlist cleared successfully", data: { products: [] } });
  } catch (error) {
    next(error);
  }
};

export const syncWishlist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).authUser._id;
    const { productIds } = req.body; // Array of product IDs from localStorage

    if (!Array.isArray(productIds)) {
      return next(createError({ statusCode: 400, message: "productIds must be an array" }));
    }

    // Validate valid ObjectIds and filter out invalid ones
    const validIds = (productIds as string[]).filter(id => typeof id === "string" && mongoose.Types.ObjectId.isValid(id));
    
    // Check which ones actually exist in DB
    const existingProducts = await Product.find({ _id: { $in: validIds } }).select("_id");
    const existingIds = existingProducts.map(p => p._id.toString());

    const wishlist = await getOrCreateWishlist(userId);

    // Merge without duplicates
    const currentProductIds = wishlist.products.map(p => p.productId.toString());
    const newItems = existingIds
      .filter(id => !currentProductIds.includes(id))
      .map(id => ({ productId: new mongoose.Types.ObjectId(id) as any, addedAt: new Date() }));

    if (newItems.length > 0) {
      wishlist.products.push(...newItems);
      await wishlist.save();
    }

    return sendResponse(res, { 
      statusCode: 200, 
      message: "Wishlist synced successfully", 
      data: wishlist 
    });
  } catch (error) {
    next(error);
  }
};
