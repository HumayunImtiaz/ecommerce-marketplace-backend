import { Router } from "express";
import {
  adminLogin,
  getAllUsers,
  temporaryDeleteUser,
  permanentDeleteUser,
  changeAdminPassword,
  updateAdminProfile,
  addUser,
  getUserById,
} from "../controllers/admin.auth.controller";
import { getDashboardStats } from "../controllers/dashboard.controller";
import { getAnalyticsStats } from "../controllers/analytics.controller";
import * as CouponController from "../../order/controllers/coupon.controller";
import { authenticateAdmin, authenticateUser } from "../../../middlewares/auth.middleware";
 
const router = Router();
 
router.post("/login", adminLogin);

router.get("/dashboard-stats", authenticateAdmin, getDashboardStats);
router.get("/analytics", authenticateAdmin, getAnalyticsStats);

// Coupon Routes (Admin)
router.get("/coupons", authenticateAdmin, CouponController.getCoupons);
router.post("/coupons", authenticateAdmin, CouponController.createCoupon);
router.patch("/coupons/:id/status", authenticateAdmin, CouponController.updateCouponStatus);
router.delete("/coupons/:id", authenticateAdmin, CouponController.deleteCoupon);
 
router.get("/users", authenticateAdmin, getAllUsers);
router.post("/users", authenticateAdmin, addUser);
router.get("/users/:userId", authenticateAdmin, getUserById);

router.patch("/users/:userId/temporary-delete", authenticateAdmin, temporaryDeleteUser);

router.delete("/users/:userId/permanent-delete", authenticateAdmin, permanentDeleteUser);

router.patch("/change-password", authenticateAdmin, changeAdminPassword);


router.patch("/profile", authenticateAdmin, updateAdminProfile);

export default router;