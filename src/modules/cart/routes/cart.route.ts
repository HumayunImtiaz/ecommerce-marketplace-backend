import { Router } from "express";
import {
  getCart,
  addToCart,
  updateQuantity,
  removeFromCart,
  clearCart,
} from "../controllers/cart.controller";
import { authenticateUser } from "../../../middlewares/auth.middleware";

const router = Router();

// All routes are protected and for logged-in users
router.use(authenticateUser);

router.get("/", getCart);
router.post("/add", addToCart);
router.patch("/update", updateQuantity);
router.delete("/remove/:itemId", removeFromCart);
router.delete("/clear", clearCart);

export default router;
