import { Request, Response } from "express";
import Message from "../models/message.model";
import User from "../../user/models/user.model";

// Get messages for a specific chat room (e.g., specific user ID)
export const getMessagesByChatId = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const messages = await Message.find({ chatId }).sort({ createdAt: 1 });



    res.status(200).json({ success: true, count: messages.length, data: messages });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};


export const getConversations = async (req: Request, res: Response) => {
  try {

    const distinctChatIds = await Message.distinct("chatId");

    const users = await User.find({ _id: { $in: distinctChatIds } }).select("fullName email avatar");


    const conversations = await Promise.all(
      users.map(async (user) => {
        const latestMessage = await Message.findOne({ chatId: user._id.toString() })
          .sort({ createdAt: -1 })
          .select("content createdAt isRead senderModel");

        const unreadCount = await Message.countDocuments({
          chatId: user._id.toString(),
          senderModel: "User",
          isRead: false
        });

        return {
          user,
          latestMessage,
          unreadCount
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
    const { chatId } = req.params;
    const { readerRole } = req.body; // 'Admin' or 'User'

    const senderToMark = readerRole === 'Admin' ? 'User' : 'Admin';

    await Message.updateMany(
      { chatId, senderModel: senderToMark, isRead: false },
      { $set: { isRead: true } }
    );

    res.status(200).json({ success: true, message: "Messages marked as read" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
