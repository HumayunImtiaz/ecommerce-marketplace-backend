import Coupon from "../models/coupon.model";
import User from "../../user/models/user.model";
import mongoose from "mongoose";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);


export const syncStripeRedemption = async (
  userId: string,
  couponCode: string
): Promise<void> => {
  try {
    const user = await User.findById(userId).select("email fullName stripeCustomerId");
    if (!user) return;

    let stripeCustomerId = user.stripeCustomerId;


    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.fullName,
        metadata: { userId: userId.toString() },
      });
      stripeCustomerId = customer.id;
      await User.findByIdAndUpdate(userId, { stripeCustomerId });
    }

    if (!stripeCustomerId) return;


    await stripe.invoiceItems.create({
      customer: stripeCustomerId,
      amount: 0,
      currency: "usd",
      description: `Coupon redemption tracking: ${couponCode.toUpperCase()}`,
    });

    const invoice = await stripe.invoices.create({
      customer: stripeCustomerId,
      discounts: [{ coupon: couponCode.toUpperCase() }],
      auto_advance: false,
    });

    // Finalize then void — this registers the redemption in Stripe
    await stripe.invoices.finalizeInvoice(invoice.id);
    await stripe.invoices.voidInvoice(invoice.id);

    console.log(`Stripe redemption synced for coupon ${couponCode.toUpperCase()} (customer: ${stripeCustomerId})`);
  } catch (err: any) {

    console.error("syncStripeRedemption error:", err.message);
  }
};

export const createCouponService = async (couponData: any) => {
  let stripeCouponId: string | null = null;

  try {
    // 1. Build Stripe coupon params
    const stripeParams: Stripe.CouponCreateParams = {
      id: couponData.code.toUpperCase(),
      name: couponData.code.toUpperCase(),
      max_redemptions: couponData.usageLimit || undefined,
      redeem_by: couponData.expiryDate
        ? Math.floor(new Date(couponData.expiryDate).getTime() / 1000)
        : undefined,
    };

    if (couponData.discountType === "percentage") {
      stripeParams.percent_off = couponData.discountValue;
    } else {
      stripeParams.amount_off = Math.round(couponData.discountValue * 100); // cents
      stripeParams.currency = "usd";
    }

    // 2. Create in Stripe first (so we can rollback if it fails)
    const stripeCoupon = await stripe.coupons.create(stripeParams);
    stripeCouponId = stripeCoupon.id;

    // 3. Now save to MongoDB
    const coupon = new Coupon({ ...couponData, stripeCouponId });
    await coupon.save();

    return { statusCode: 201, success: true, message: "Coupon created and synced to Stripe successfully", data: coupon };
  } catch (error: any) {
    // Rollback Stripe coupon if MongoDB save fails
    if (stripeCouponId) {
      try {
        await stripe.coupons.del(stripeCouponId);
      } catch (rollbackErr) {
        console.error("Failed to rollback Stripe coupon:", rollbackErr);
      }
    }
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
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return { statusCode: 404, success: false, message: "Coupon not found", data: null };
    }

    // Delete from Stripe (use the code as the Stripe coupon ID)
    try {
      await stripe.coupons.del(coupon.code.toUpperCase());
    } catch (stripeError: any) {
      // If it's not found in Stripe, that's fine — just log it
      if (stripeError?.code !== "resource_missing") {
        console.error("Stripe coupon deletion failed:", stripeError.message);
      }
    }

    // Delete from MongoDB
    await Coupon.findByIdAndDelete(couponId);

    return { statusCode: 200, success: true, message: "Coupon deleted from DB and Stripe successfully", data: null };
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
