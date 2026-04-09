import express from "express";
import { getMessagesByChatId, getConversations, markChatAsRead } from "../controllers/message.controller";
import { authenticateAdmin } from "../../../middlewares/auth.middleware";

const router = express.Router();

// Admin routes
router.get("/conversations", authenticateAdmin, getConversations);

// General (User/Admin) routes
router.get("/:chatId", getMessagesByChatId);
router.put("/:chatId/read", markChatAsRead);

export default router;
