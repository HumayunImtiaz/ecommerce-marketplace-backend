import { Router } from "express";
import {
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
} from "../controllers/vendor.controller";
import {
  getVendorPayoutHistory,
  createPayoutRequest,
  getAllPayoutRequests,
  approvePayout,
} from "../controllers/payout.controller";
import {
  authenticateUser,
  authenticateAdmin,
  authenticateVendor,
} from "../../../middlewares/auth.middleware";

const router = Router();

// ── User Routes (logged-in user applies to become vendor) ──
router.post("/register", authenticateUser, registerVendor);

// ── Vendor Routes (approved vendors only) ──
router.get("/profile", authenticateVendor, getVendorProfile);
router.get("/dashboard", authenticateVendor, getVendorDashboard);
router.get("/orders", authenticateVendor, getVendorOrders);
router.get("/orders/:id", authenticateVendor, getVendorOrderDetail);
router.patch("/profile", authenticateVendor, updateVendorProfile);
router.get("/payout/history", authenticateVendor, getVendorPayoutHistory);
router.post("/payout/request", authenticateVendor, createPayoutRequest);

// ── Admin Routes (manage vendor applications) ──
router.get("/admin/all", authenticateAdmin, getAllVendors);
router.patch("/admin/:id/approve", authenticateAdmin, approveVendor);
router.patch("/admin/:id/suspend", authenticateAdmin, suspendVendor);
router.delete("/admin/:id/reject", authenticateAdmin, rejectVendor);
router.get("/admin/payouts", authenticateAdmin, getAllPayoutRequests);
router.patch("/admin/payouts/:id/approve", authenticateAdmin, approvePayout);
router.get("/admin/vendors/:id", authenticateAdmin, getVendorDetail);
router.patch("/admin/:id/commission", authenticateAdmin, updateVendorCommission);
router.get("/admin/analytics/platform", authenticateAdmin, getPlatformAnalytics);

export default router;
