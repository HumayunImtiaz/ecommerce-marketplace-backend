import { Router } from "express";
import {
  addWishlist,
  removeWishlist,
  getWishlist,
  clearWishlist,
  syncWishlist,
} from "../controllers/wishlist.controller";
import { authenticateUser } from "../../../middlewares/auth.middleware";

const router = Router();

// All wishlist routes require user authentication
router.use(authenticateUser);

router.post("/", addWishlist);
router.get("/", getWishlist);
router.delete("/", clearWishlist);
router.delete("/:productId", removeWishlist);
router.post("/sync", syncWishlist);

export default router;
