import { Request, Response } from "express";
import prisma from "../../../config/prisma";
import sendResponse from "../../../utils/apiResponse";

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return sendResponse(res, {
      statusCode: 200,
      success: true,
      data: notifications,
      message: "Notifications fetched successfully",
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const count = await prisma.notification.count({
      where: { isRead: false },
    });

    return sendResponse(res, {
      statusCode: 200,
      success: true,
      data: { count },
      message: "Unread count fetched",
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const notification = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return sendResponse(res, {
      statusCode: 200,
      success: true,
      data: notification,
      message: "Notification marked as read",
    });
  } catch (error: any) {
    // Prisma will throw an error if the record is not found
    return res.status(404).json({
      success: false,
      data: null,
      message: "Notification not found",
    });
  }
};

export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });

    return sendResponse(res, {
      statusCode: 200,
      success: true,
      data: null,
      message: "All notifications marked as read",
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    await prisma.notification.delete({
      where: { id },
    });

    return sendResponse(res, {
      statusCode: 200,
      success: true,
      data: null,
      message: "Notification deleted successfully",
    });
  } catch (error: any) {
    return res.status(404).json({
      success: false,
      data: null,
      message: "Notification not found",
    });
  }
};
