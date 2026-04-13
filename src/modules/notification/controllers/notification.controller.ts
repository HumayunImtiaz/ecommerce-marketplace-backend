import { Request, Response } from "express";
import Notification from "../models/notification.model";
import sendResponse from "../../../utils/apiResponse";

export const getNotifications = async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;

  const notifications = await Notification.find()
    .sort({ createdAt: -1 })
    .limit(limit);

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    data: notifications,
    message: "Notifications fetched successfully",
  });
};

export const getUnreadCount = async (req: Request, res: Response) => {
  const count = await Notification.countDocuments({ isRead: false });

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    data: { count },
    message: "Unread count fetched",
  });
};

export const markAsRead = async (req: Request, res: Response) => {
  const { id } = req.params;

  const notification = await Notification.findByIdAndUpdate(
    id,
    { isRead: true },
    { new: true }
  );

  if (!notification) {
    return sendResponse(res, {
      statusCode: 404,
      success: false,
      data: null,
      message: "Notification not found",
    });
  }

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    data: notification,
    message: "Notification marked as read",
  });
};

export const markAllAsRead = async (req: Request, res: Response) => {
  await Notification.updateMany({ isRead: false }, { isRead: true });

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    data: null,
    message: "All notifications marked as read",
  });
};

export const deleteNotification = async (req: Request, res: Response) => {
  const { id } = req.params;

  const notification = await Notification.findByIdAndDelete(id);

  if (!notification) {
    return sendResponse(res, {
      statusCode: 404,
      success: false,
      data: null,
      message: "Notification not found",
    });
  }

  return sendResponse(res, {
    statusCode: 200,
    success: true,
    data: null,
    message: "Notification deleted successfully",
  });
};
