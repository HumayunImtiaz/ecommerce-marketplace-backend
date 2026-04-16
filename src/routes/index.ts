import { Router, Request, Response } from "express";
import sendResponse from "../utils/apiResponse";
import adminAuthRoutes from "../modules/admin/routes/admin.auth.route";
import userAuthRoutes from "../modules/user/routes/user.auth.route";
import categoryRoutes from "../modules/product/routes/category.route";
import productRoutes from "../modules/product/routes/product.route";
import uploadRoutes from "../modules/product/routes/upload.route";
import reviewRoutes from "../modules/review/routes/review.route";
import orderRoutes from "../modules/order/routes/order.route";
import cartRoutes from "../modules/cart/routes/cart.route";
import wishlistRoutes from "../modules/wishlist/routes/wishlist.route";
import settingsRoutes from "../modules/admin/routes/settings.routes";
import newsletterRoutes from "../modules/newsletter/routes/newsletter.route";
import contactRoutes from "../modules/contact/routes/contact.route";
import messageRoutes from "../modules/message/routes/message.route";
import notificationRoutes from "../modules/notification/routes/notification.route";

const router = Router();

router.get("/health", (req: Request, res: Response) => {
  return sendResponse(res, {
    statusCode: 200,
    success: true,
    data: { server: "running" },
    message: "API is working fine",
  });
});

router.use("/auth/admin", adminAuthRoutes);
router.use("/auth/user", userAuthRoutes);
router.use("/categories", categoryRoutes);
router.use("/products", productRoutes);
router.use("/upload", uploadRoutes);
router.use("/reviews", reviewRoutes);
router.use("/orders", orderRoutes);
router.use("/cart", cartRoutes);
router.use("/wishlist", wishlistRoutes);
router.use("/settings", settingsRoutes);
router.use("/newsletter", newsletterRoutes);
router.use("/contact", contactRoutes);
router.use("/messages", messageRoutes);
router.use("/notifications", notificationRoutes);

router.get("/config/stripe", (req: Request, res: Response) => {
  return sendResponse(res, {
    statusCode: 200,
    success: true,
    data: { publishableKey: process.env.STRIPE_PUBLISHABLE_KEY },
    message: "Stripe configure loaded",
  });
});

export default router;