import { Router } from "express";
import {
  forgotPassword,
  loginUser,
  registerUser,
  resetPassword,
  resendVerificationEmail,
  socialLogin,
  verifyEmail,
  requestAccountDeletion,
  getEmailPreferences,
  updateEmailPreferences,
  updateUserProfile,
} from "../controllers/user.auth.controller";
import {
  checkLocalProviderBeforeLogin,
  checkUserVerifiedBeforeLogin,
  authenticateUser,
} from "../../../middlewares/auth.middleware";
import { storageData } from "../../../utils/multer";
import addressRoutes from "./address.routes";

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

router.post("/request-deletion", authenticateUser, requestAccountDeletion);

router.get("/email-preferences", authenticateUser, getEmailPreferences);
router.patch("/email-preferences", authenticateUser, updateEmailPreferences);

router.patch("/profile", authenticateUser, storageData("uploads").single("avatar"), updateUserProfile);

router.use("/addresses", addressRoutes);

export default router;