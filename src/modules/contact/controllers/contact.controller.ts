import { Request, Response } from "express";
import { contactService } from "../services/contact.service";
import sendResponse from "../../../utils/apiResponse";

export const createInquiry = async (req: Request, res: Response) => {
  try {
    const inquiry = await contactService.createInquiry(req.body);
    return sendResponse(res, {
      statusCode: 201,
      success: true,
      data: inquiry,
      message: "Your message has been sent successfully. We'll get back to you within 24 hours.",
    });
  } catch (error) {
    return sendResponse(res, {
      statusCode: 500,
      success: false,
      message: "An error occurred while sending your message. Please try again later.",
    });
  }
};

export const getAllInquiries = async (req: Request, res: Response) => {
  try {
    const inquiries = await contactService.getAllInquiries();
    return sendResponse(res, {
      statusCode: 200,
      success: true,
      data: inquiries,
      message: "Inquiries fetched successfully",
    });
  } catch (error) {
    return sendResponse(res, {
      statusCode: 500,
      success: false,
      message: "Failed to fetch inquiries",
    });
  }
};

export const updateInquiryStatus = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { isRead } = req.body;
    const inquiry = await contactService.updateInquiryStatus(id, isRead);
    if (!inquiry) {
      return sendResponse(res, {
        statusCode: 404,
        success: false,
        message: "Inquiry not found",
      });
    }
    return sendResponse(res, {
      statusCode: 200,
      success: true,
      data: inquiry,
      message: "Inquiry status updated successfully",
    });
  } catch (error) {
    return sendResponse(res, {
      statusCode: 500,
      success: false,
      message: "Failed to update inquiry status",
    });
  }
};

export const replyToInquiry = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { message } = req.body;
    if (!message) {
      return sendResponse(res, {
        statusCode: 400,
        success: false,
        message: "Reply message is required",
      });
    }
    const inquiry = await contactService.sendReply(id, message);
    return sendResponse(res, {
      statusCode: 200,
      success: true,
      data: inquiry,
      message: "Reply sent successfully to customer",
    });
  } catch (error: any) {
    return sendResponse(res, {
      statusCode: 500,
      success: false,
      message: error.message || "Failed to send reply",
    });
  }
};
