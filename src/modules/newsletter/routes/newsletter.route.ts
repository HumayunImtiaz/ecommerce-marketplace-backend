import { Router } from "express";
import {
  subscribe,
  unsubscribe,
  broadcast,
  getLogs,
} from "../controllers/newsletter.controller";
import { authenticateAdmin } from "../../../middlewares/auth.middleware";

const router = Router();

router.post("/", subscribe);
router.post("/unsubscribe", unsubscribe);

// --- Admin Endpoints ---
router.post("/broadcast", authenticateAdmin, broadcast);
router.get("/logs", authenticateAdmin, getLogs);

export default router;
