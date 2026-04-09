import { Router } from "express";
import { getProductReviews, createReview } from "../controllers/review.controller";
import { authenticateUser } from "../../../middlewares/auth.middleware";

const router = Router();

//  koi bhi dekh sakta hai
router.get("/:productId", getProductReviews);

// sirf logged in user
router.post("/:productId", authenticateUser, createReview);

export default router;