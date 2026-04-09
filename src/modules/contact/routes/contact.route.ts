import { Router } from "express";
import * as contactController from "../controllers/contact.controller";

const router = Router();

router.post("/", contactController.createInquiry);
router.get("/", contactController.getAllInquiries);
router.patch("/:id/read", contactController.updateInquiryStatus);
router.post("/:id/reply", contactController.replyToInquiry);

export default router;
