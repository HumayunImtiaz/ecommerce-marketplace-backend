import { Router } from "express";
import {
  createCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,
} from "../controllers/category.controller";
import { authenticateAdmin } from "../../../middlewares/auth.middleware";

const router = Router();

router.post(
  "/",
  authenticateAdmin,
  createCategory
);

router.get("/", getAllCategories);

router.patch(
  "/:categoryId",
  authenticateAdmin,
  updateCategory
);

router.delete(
  "/:categoryId",
  authenticateAdmin,
  deleteCategory
);

export default router;