import { NextFunction, Request, Response } from "express";
import {
  registerVendorService,
  getVendorProfileService,
  getVendorDashboardService,
  getAllVendorsService,
  approveVendorService,
  suspendVendorService,
  rejectVendorService,
  updateVendorCommissionService,
  getPlatformAnalyticsService,
  getVendorDetailService,
  getVendorOrdersService,
  updateVendorProfileService,
  getVendorOrderDetailService,
} from "../services/vendor.service";

// ── User: Register as vendor ──
const registerVendor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = String((req as any).authUser?.id || "");
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized", data: null });

    const result = await registerVendorService(userId, req.body);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
};

// ── Vendor: Get own profile ──
const getVendorProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = String((req as any).authVendor?.id || "");
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized", data: null });

    const result = await getVendorProfileService(userId);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
};

// ── Vendor: Get dashboard stats ──
const getVendorDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vendorId = String((req as any).authVendor?.vendor?.id || "");
    if (!vendorId) return res.status(401).json({ success: false, message: "Unauthorized", data: null });

    const result = await getVendorDashboardService(vendorId);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
};

// ── Admin: Get all vendors ──
const getAllVendors = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string | undefined;
    const result = await getAllVendorsService(status);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
};

// ── Admin: Approve vendor ──
const approveVendor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vendorId = String(req.params.id);
    const result = await approveVendorService(vendorId);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
};

// ── Admin: Suspend vendor ──
const suspendVendor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vendorId = String(req.params.id);
    const result = await suspendVendorService(vendorId);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
};

// ── Admin: Reject vendor ──
const rejectVendor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vendorId = String(req.params.id);
    const result = await rejectVendorService(vendorId);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
};

// ── Admin: Update Commission Rate ──
const updateVendorCommission = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vendorId = String(req.params.id);
    const { commissionRate } = req.body;
    const result = await updateVendorCommissionService(vendorId, Number(commissionRate));
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
};

// ── Admin: Get Platform Analytics ──
const getPlatformAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await getPlatformAnalyticsService();
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
};

const getVendorDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vendorId = String(req.params.id);
    const result = await getVendorDetailService(vendorId);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
};

const getVendorOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const result = await getVendorOrdersService(userId);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
};

const updateVendorProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const result = await updateVendorProfileService(userId, req.body);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
};

const getVendorOrderDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const orderId = String(req.params.id);
    const result = await getVendorOrderDetailService(userId, orderId);
    return res.status(result.statusCode).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    return next(error);
  }
};

export {
  registerVendor,
  getVendorProfile,
  getVendorDashboard,
  getAllVendors,
  approveVendor,
  suspendVendor,
  rejectVendor,
  updateVendorCommission,
  getPlatformAnalytics,
  getVendorDetail,
  getVendorOrders,
  updateVendorProfile,
  getVendorOrderDetail,
};
