import { Router } from "express";
import {
  forgotPassword,
  loginUser,
  registerUser,
  resetPassword,
  resendVerificationEmail,
  socialLogin,
  verifyEmail,
} from "../controllers/user.auth.controller";
import {
  checkLocalProviderBeforeLogin,
  checkUserVerifiedBeforeLogin,
} from "../../../middlewares/auth.middleware";
import { storageData } from "../../../utils/multer";

const router = Router();

router.post(
  "/register",
  storageData("uploads").single("avatar"),
  registerUser
);

router.get("/verify-email/:token", verifyEmail);

router.post("/resend-verification-code", resendVerificationEmail);

router.post("/social-login", socialLogin);

router.post(
  "/login",
  checkLocalProviderBeforeLogin,
  checkUserVerifiedBeforeLogin,
  loginUser
);

router.post("/forgot-password", forgotPassword);

router.post("/reset-password/:token", resetPassword);

export default router;