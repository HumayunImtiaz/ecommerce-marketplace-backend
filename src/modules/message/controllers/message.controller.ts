import { Request, Response } from "express";
import prisma from "../../../config/prisma";

// Get messages for a specific chat room (e.g., specific user ID)
export const getMessagesByChatId = async (req: Request, res: Response) => {
  try {
    const chatId = req.params.chatId as string;
    const messages = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: "asc" },
    });

    res.status(200).json({ success: true, count: messages.length, data: messages });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getConversations = async (req: Request, res: Response) => {
  try {
    // In Prisma, we don't have distinct("chatId") directly on findMany, 
    // but we can use groupBy or just fetch unique chatId if they are many.
    // However, the best way to get conversations is to get all messages and group them in JS, 
    // or use a more specific query. 
    // Let's get distinct chatIds first.
    
    const messages = await prisma.message.findMany({
      select: { chatId: true },
      distinct: ['chatId'],
    });
    
    const distinctChatIds = messages.map(m => m.chatId);

    const users = await prisma.user.findMany({
      where: { id: { in: distinctChatIds } },
      select: { id: true, fullName: true, email: true, avatar: true },
    });

    const conversations = await Promise.all(
      users.map(async (user) => {
        const latestMessage = await prisma.message.findFirst({
          where: { chatId: user.id },
          orderBy: { createdAt: "desc" },
          select: { content: true, createdAt: true, isRead: true, senderModel: true },
        });

        const unreadCount = await prisma.message.count({
          where: {
            chatId: user.id,
            senderModel: "User",
            isRead: false,
          },
        });

        return {
          user,
          latestMessage,
          unreadCount,
        };
      })
    );

    // Sort conversations by latest message time
    conversations.sort((a, b) => {
      const timeA = a.latestMessage ? new Date(a.latestMessage.createdAt).getTime() : 0;
      const timeB = b.latestMessage ? new Date(b.latestMessage.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    res.status(200).json({ success: true, count: conversations.length, data: conversations });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Mark conversation messages as read
export const markChatAsRead = async (req: Request, res: Response) => {
  try {
    const chatId = req.params.chatId as string;
    const { readerRole } = req.body; // 'Admin' or 'User'

    const senderToMark = readerRole === 'Admin' ? 'User' : 'Admin';

    await prisma.message.updateMany({
      where: {
        chatId,
        senderModel: senderToMark,
        isRead: false,
      },
      data: { isRead: true },
    });

    res.status(200).json({ success: true, message: "Messages marked as read" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
