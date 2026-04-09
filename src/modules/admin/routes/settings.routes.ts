import { Router } from "express";
import { getSettings, updateSettings } from "../controllers/settings.controller";
import { authenticateAdmin } from "../../../middlewares/auth.middleware";

const router = Router();

// Public route to get site settings (Logo, Hero, etc.)
router.get("/", getSettings);

// Protected route to update site settings
router.patch("/", authenticateAdmin, updateSettings);

export default router;
