import prisma from "../../../config/prisma";
import { notifyAdmin } from "../../../utils/notification.utils";
import mailTransporter from "../../../config/mail";

const createInquiry = async (data: any) => {
  const inquiry = await prisma.contact.create({
    data: {
      name: data.name,
      email: data.email,
      subject: data.subject,
      message: data.message,
      category: data.category || "general",
      orderNumber: data.orderNumber,
    },
  });

  // Unified Notification dispatch (Dashboard + Email + SMS simulation)
  await notifyAdmin({
    title: "New Customer Inquiry",
    message: `${data.name} sent a new message regarding ${data.subject}`,
    type: "info",
    relatedId: inquiry.id,
    relatedModel: "Contact",
    category: "customerNotifications",
  });

  return inquiry;
};

const getAllInquiries = async () => {
  return await prisma.contact.findMany({
    orderBy: { createdAt: "desc" },
  });
};

const updateInquiryStatus = async (id: string, isRead: boolean) => {
  return await prisma.contact.update({
    where: { id },
    data: { isRead },
  });
};

const sendReply = async (id: string, replyMessage: string) => {
  const inquiry = await prisma.contact.findUnique({
    where: { id },
  });
  if (!inquiry) throw new Error("Inquiry not found");

  const siteSettings = await prisma.siteSettings.findFirst();
  const adminEmail = siteSettings?.adminEmail || process.env.MAIL_USER;

  await mailTransporter.sendMail({
    from: process.env.MAIL_FROM,
    to: inquiry.email,
    subject: `Re: ${inquiry.subject}`,
    text: replyMessage,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
        <div style="background: #4f46e5; color: white; padding: 24px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px;">Message from LuxeCarts Support</h2>
        </div>
        <div style="padding: 32px 24px; background: white;">
          <p style="margin-top: 0; color: #111827; font-size: 16px; line-height: 1.6;">
            ${replyMessage.replace(/\n/g, "<br>")}
          </p>
          <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #6b7280; font-size: 14px; font-weight: bold;">Regards,</p>
            <p style="margin: 4px 0 0; color: #4f46e5; font-size: 14px; font-weight: bold;">LuxeCarts Team</p>
          </div>
        </div>
        <div style="padding: 16px 24px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
           <details>
             <summary style="cursor: pointer; color: #6b7280; font-size: 12px; outline: none;">View original message</summary>
             <div style="margin-top: 12px; padding: 12px; background: white; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 12px; color: #4b5563;">
               <strong>Subject:</strong> ${inquiry.subject}<br>
               <strong>Date:</strong> ${inquiry.createdAt.toLocaleDateString()}<br><br>
               ${inquiry.message.replace(/\n/g, "<br>")}
             </div>
           </details>
        </div>
      </div>
    `,
  });

  return await prisma.contact.update({
    where: { id },
    data: { isRead: true },
  });
};

export const contactService = {
  createInquiry,
  getAllInquiries,
  updateInquiryStatus,
  sendReply,
};
