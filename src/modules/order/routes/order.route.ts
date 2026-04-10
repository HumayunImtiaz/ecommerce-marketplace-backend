import { Router } from "express";
import {
  createPaymentIntent,
  createOrder,
  getUserOrders,
  getAllAdminOrders,
  updateOrderStatus,
  getOrderById,
  getUserOrdersForAdmin,
  confirmOrderPayment,
} from "../controllers/order.controller";
import * as CouponController from "../controllers/coupon.controller";
import { authenticateUser, authenticateAdmin } from "../../../middlewares/auth.middleware";

const router = Router();

// POST /api/auth/orders/payment-intent — Stripe payment intent banao (auth ki zaroorat nahi)
router.post("/payment-intent", createPaymentIntent);

// POST /api/auth/orders — Order place karo
router.post("/", authenticateUser, createOrder);

// GET /api/auth/orders — User ke orders
router.get("/", authenticateUser, getUserOrders);

// GET /api/auth/orders/all — Admin ke liye sab orders
router.get("/all", authenticateAdmin, getAllAdminOrders);

// PATCH /api/auth/orders/:id/status — Admin manually updates order status
router.patch("/:id/status", authenticateAdmin, updateOrderStatus);

// GET /api/auth/orders/:id — Admin single order detail
router.get("/:id", authenticateAdmin, getOrderById);

// GET /api/auth/orders/user/:userId — Admin get specific user's orders
router.get("/user/:userId", authenticateAdmin, getUserOrdersForAdmin);

// POST /api/auth/orders/:orderId/confirm-payment — User confirms Stripe payment
router.post("/:orderId/confirm-payment", authenticateUser, confirmOrderPayment);

// ─── Coupon Routes (User) ───────────────────────────────────────────────────
// POST /api/auth/orders/coupons/validate — User validates coupon at checkout
router.post("/coupons/validate", authenticateUser, CouponController.validateCoupon);

// GET /api/auth/orders/coupons/public — Public coupons for homepage
router.get("/coupons/public", CouponController.getPublicCoupons);

export default router;