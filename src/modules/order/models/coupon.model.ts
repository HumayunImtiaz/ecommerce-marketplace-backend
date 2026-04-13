import mongoose, { Schema, Document } from "mongoose";

export interface ICoupon extends Document {
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minPurchase: number;
  expiryDate: Date;
  usageLimit: number; // Total usages allowed
  limitPerUser: number; // Usages allowed per user
  usedCount: number; // Current total usage
  usedBy: { userId: mongoose.Types.ObjectId; count: number }[];
  isPublic: boolean;
  isActive: boolean;
  stripeCouponId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema: Schema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    discountType: { type: String, enum: ["percentage", "fixed"], required: true },
    discountValue: { type: Number, required: true },
    minPurchase: { type: Number, default: 0 },
    expiryDate: { type: Date, required: true },
    usageLimit: { type: Number, default: 100 },
    limitPerUser: { type: Number, default: 1 },
    usedCount: { type: Number, default: 0 },
    usedBy: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User" },
        count: { type: Number, default: 0 },
      },
    ],
    isPublic: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    stripeCouponId: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model<ICoupon>("Coupon", CouponSchema);
