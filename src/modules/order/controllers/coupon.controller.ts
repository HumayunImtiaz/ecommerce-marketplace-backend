import { Request, Response, NextFunction } from "express";
import * as CouponService from "../services/coupon.service";

// ─── ADMIN CONTROLLERS ────────────────────────────────────────────────────────

export const createCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await CouponService.createCouponService(req.body);
    return res.status(result.statusCode).json(result);
  } catch (error) {
    return next(error);
  }
};

export const getCoupons = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await CouponService.getCouponsService();
    return res.status(result.statusCode).json(result);
  } catch (error) {
    return next(error);
  }
};

export const deleteCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await CouponService.deleteCouponService(req.params.id as string);
    return res.status(result.statusCode).json(result);
  } catch (error) {
    return next(error);
  }
};

export const updateCouponStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await CouponService.updateCouponStatusService(req.params.id as string, req.body.isActive);
    return res.status(result.statusCode).json(result);
  } catch (error) {
    return next(error);
  }
};

// ─── USER CONTROLLERS ─────────────────────────────────────────────────────────

export const validateCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, subtotal } = req.body;
    const userId = (req as any).authUser?.id; // Extracted from auth middleware
    
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized: User not found in request" });
    }

    const result = await CouponService.validateCouponService(code, userId, subtotal);
    return res.status(result.statusCode).json(result);
  } catch (error) {
    return next(error);
  }
};

export const getPublicCoupons = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await CouponService.getPublicCouponsService();
    return res.status(result.statusCode).json(result);
  } catch (error) {
    return next(error);
  }
};
