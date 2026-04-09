import { Router } from "express";
import {
  createProduct,
  getProductBySlug,
  getAllProducts,
  updateProduct,
  deleteProduct,
  bulkUpdateProductStatus,
  bulkDeleteProducts,
} from "../controllers/product.controller";
import { authenticateAdmin } from "../../../middlewares/auth.middleware";

const router = Router();

router.post(
  "/",
  authenticateAdmin,
  createProduct
);

router.get("/", getAllProducts);
router.get("/slug/:slug", getProductBySlug);

router.patch(
  "/bulk-status",
  authenticateAdmin,
  bulkUpdateProductStatus
);

router.delete(
  "/bulk-delete",
  authenticateAdmin,
  bulkDeleteProducts
);

router.put(
  "/:productId",
  authenticateAdmin,
  updateProduct
);

router.delete(
  "/:productId",
  authenticateAdmin,
  deleteProduct
);

export default router;