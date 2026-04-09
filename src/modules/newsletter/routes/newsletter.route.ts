import { Router } from "express";
import {
  subscribe,
  unsubscribe,
} from "../controllers/newsletter.controller";

const router = Router();

router.post("/", subscribe);
router.post("/unsubscribe", unsubscribe);

export default router;
