import { NextFunction, Request, Response } from "express";
import {
  createPaymentIntentService,
  createOrderService,
  getUserOrdersService,
  getAllOrdersService,
  getOrderByIdService,
  updateOrderStatusService,
  confirmOrderPaymentService,
} from "../services/order.service";

type RequestWithUser = Request & { authUser?: any };

// ── Create Payment Intent ─────────────────────────────────────────────────────
export const createPaymentIntent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount } = req.body;
    const result = await createPaymentIntentService(amount);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
};

// ── Create Order ──────────────────────────────────────────────────────────────
export const createOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = String((req as RequestWithUser).authUser?.id || "");
    const result = await createOrderService(userId, req.body);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
      ...(result.errors && { errors: result.errors }),
    });
  } catch (error) {
    return next(error);
  }
};

// ── Get User Orders ───────────────────────────────────────────────────────────
export const getUserOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = String((req as RequestWithUser).authUser?.id || "");
    const result = await getUserOrdersService(userId);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
};

// ── Get All Orders (Admin) ────────────────────────────────────────────────────
export const getAllAdminOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await getAllOrdersService();
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
};

// ── Update Order Status (Admin) ───────────────────────────────────────────────
export const updateOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ success: false, message: "Status is required" });
    }

    const result = await updateOrderStatusService(id, status);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
};

// ── Get Single Order by ID (Admin) ───────────────────────────────────────────
export const getOrderById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const result = await getOrderByIdService(id);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
};

// ── Get Orders for a specific user (Admin) ────────────────────────────────────
export const getUserOrdersForAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.userId as string;
    const result = await getUserOrdersService(userId);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
};

// ── Confirm Stripe Payment (user calls after frontend confirms) ────────────────
export const confirmOrderPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderId = req.params.orderId as string;
    const { paymentIntentId } = req.body;
    const userId = String((req as RequestWithUser).authUser?.id || "");

    if (!paymentIntentId) {
      return res.status(400).json({ success: false, message: "paymentIntentId is required" });
    }

    const result = await confirmOrderPaymentService(orderId, paymentIntentId, userId);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
};