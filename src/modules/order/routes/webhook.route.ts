import { Router } from "express";
import { handleStripeWebhook } from "../services/webhook.service";

const router = Router();

// Endpoint for Stripe Webhook
router.post("/", handleStripeWebhook);

export default router;
