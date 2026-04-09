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
import { authenticateAdmin } from "../../../middlewares/auth.middleware";
 
const router = Router();
 
router.post("/login", adminLogin);
 
router.get("/users", authenticateAdmin, getAllUsers);
router.post("/users", authenticateAdmin, addUser);
router.get("/users/:userId", authenticateAdmin, getUserById);

router.patch("/users/:userId/temporary-delete", authenticateAdmin, temporaryDeleteUser);

router.delete("/users/:userId/permanent-delete", authenticateAdmin, permanentDeleteUser);

router.patch("/change-password", authenticateAdmin, changeAdminPassword);


router.patch("/profile", authenticateAdmin, updateAdminProfile);

export default router;