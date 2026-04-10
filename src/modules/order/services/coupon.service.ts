import Coupon from "../models/coupon.model";
import mongoose from "mongoose";

export const createCouponService = async (couponData: any) => {
  try {
    const coupon = new Coupon(couponData);
    await coupon.save();
    return { statusCode: 201, success: true, message: "Coupon created successfully", data: coupon };
  } catch (error: any) {
    return { statusCode: 500, success: false, message: error.message || "Failed to create coupon", data: null };
  }
};

export const getCouponsService = async () => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    return { statusCode: 200, success: true, message: "Coupons fetched successfully", data: coupons };
  } catch (error: any) {
    return { statusCode: 500, success: false, message: error.message || "Failed to fetch coupons", data: null };
  }
};

export const deleteCouponService = async (couponId: string) => {
  try {
    await Coupon.findByIdAndDelete(couponId);
    return { statusCode: 200, success: true, message: "Coupon deleted successfully", data: null };
  } catch (error: any) {
    return { statusCode: 500, success: false, message: error.message || "Failed to delete coupon", data: null };
  }
};

export const validateCouponService = async (code: string, userId: string, subtotal: number) => {
  try {
    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });

    if (!coupon) {
      return { statusCode: 404, success: false, message: "Invalid coupon code", data: null };
    }

    const now = new Date();
    if (coupon.expiryDate < now) {
      return { statusCode: 400, success: false, message: "Coupon has expired", data: null };
    }

    if (coupon.usedCount >= coupon.usageLimit) {
      return { statusCode: 400, success: false, message: "Coupon usage limit reached", data: null };
    }

    if (subtotal < coupon.minPurchase) {
      return { statusCode: 400, success: false, message: `Minimum purchase of $${coupon.minPurchase} required`, data: null };
    }

    // Check per-user limit
    const userUsage = coupon.usedBy.find(u => u.userId.toString() === userId);
    if (userUsage && userUsage.count >= coupon.limitPerUser) {
      return { statusCode: 400, success: false, message: "You have already reached the usage limit for this coupon", data: null };
    }

    return { statusCode: 200, success: true, message: "Coupon is valid", data: coupon };
  } catch (error: any) {
    return { statusCode: 500, success: false, message: error.message || "Failed to validate coupon", data: null };
  }
};

export const getPublicCouponsService = async () => {
  try {
    const coupons = await Coupon.find({ isPublic: true, isActive: true, expiryDate: { $gt: new Date() } });
    return { statusCode: 200, success: true, message: "Public coupons fetched successfully", data: coupons };
  } catch (error: any) {
    return { statusCode: 500, success: false, message: error.message || "Failed to fetch public coupons", data: null };
  }
};

export const updateCouponStatusService = async (couponId: string, isActive: boolean) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(couponId, { isActive }, { new: true });
    return { statusCode: 200, success: true, message: "Coupon status updated", data: coupon };
  } catch (error: any) {
    return { statusCode: 500, success: false, message: error.message || "Failed to update status", data: null };
  }
};
