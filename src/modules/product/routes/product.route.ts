import { Router } from "express";
import {
  createProduct,
  getProductBySlug,
  getAllProducts,
  updateProduct,
  deleteProduct,
  bulkUpdateProductStatus,
  bulkDeleteProducts,
  getPendingProducts,
  updateProductApprovalStatus,
} from "../controllers/product.controller";
import { authenticateStaff } from "../../../middlewares/auth.middleware";

const router = Router();

router.post(
  "/",
  authenticateStaff,
  createProduct
);

router.get("/", getAllProducts);
router.get("/slug/:slug", getProductBySlug);
router.get("/approval/pending", authenticateStaff, getPendingProducts);

router.patch(
  "/bulk-status",
  authenticateStaff,
  bulkUpdateProductStatus
);

router.delete(
  "/bulk-delete",
  authenticateStaff,
  bulkDeleteProducts
);

router.put(
  "/:productId",
  authenticateStaff,
  updateProduct
);

router.delete(
  "/:productId",
  authenticateStaff,
  deleteProduct
);

router.patch("/approval/:productId/status", authenticateStaff, updateProductApprovalStatus);

export default router;