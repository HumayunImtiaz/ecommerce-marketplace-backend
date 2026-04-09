import Contact, { IContact } from "../models/contact.model";
import SiteSettings from "../../admin/models/site-settings.model";
import mailTransporter from "../../../config/mail";

const createInquiry = async (data: Partial<IContact>) => {
  const inquiry = await Contact.create(data);

  // Send email to admin
  try {
    const settings = await SiteSettings.findOne();
    const rawAdminEmail = settings?.adminEmail || process.env.MAIL_USER;
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const adminEmail = emailRegex.test(rawAdminEmail || "") ? rawAdminEmail : process.env.MAIL_USER;

    console.log("Found site settings:", settings?.storeName);
    console.log("Target admin email:", adminEmail);

    if (adminEmail) {
      console.log("Attempting to send email...");
      // Verify connection config
      await mailTransporter.verify();
      
      const info = await mailTransporter.sendMail({
        from: process.env.MAIL_FROM,
        to: adminEmail,
        subject: `New Contact Inquiry: ${data.subject}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 10px;">New Contact Inquiry</h2>
            <p style="margin: 20px 0;"><strong>Name:</strong> ${data.name}</p>
            <p style="margin: 20px 0;"><strong>Email:</strong> ${data.email}</p>
            <p style="margin: 20px 0;"><strong>Category:</strong> ${data.category || "general"}</p>
            <p style="margin: 20px 0;"><strong>Order Number:</strong> ${data.orderNumber || "N/A"}</p>
            <p style="margin: 20px 0;"><strong>Subject:</strong> ${data.subject}</p>
            <div style="background: #f9fafb; padding: 15px; border-radius: 5px; margin-top: 20px;">
              <p style="margin: 0;"><strong>Message:</strong></p>
              <p style="white-space: pre-wrap; margin-top: 10px;">${data.message}</p>
            </div>
            <p style="margin-top: 30px; font-size: 12px; color: #6b7280; text-align: center;">
              This notification was sent automatically from your store's contact form.
            </p>
          </div>
        `,
      });
      console.log("Email sent successfully. Message ID:", info.messageId);
    } else {
      console.warn("No valid admin email found in settings or ENV.");
    }
  } catch (error) {
    console.error("Failed to send contact inquiry email:", error);
    // We don't throw here to avoid failing the whole request if email fails
  }

  return inquiry;
};

const getAllInquiries = async () => {
  return await Contact.find().sort({ createdAt: -1 });
};

const updateInquiryStatus = async (id: string, isRead: boolean) => {
  return await Contact.findByIdAndUpdate(id, { isRead }, { new: true });
};

const sendReply = async (id: string, replyMessage: string) => {
  const inquiry = await Contact.findById(id);
  if (!inquiry) throw new Error("Inquiry not found");

  const adminEmail = (await SiteSettings.findOne())?.adminEmail || process.env.MAIL_USER;

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

  inquiry.isRead = true;
  await inquiry.save();
  return inquiry;
};

export const contactService = {
  createInquiry,
  getAllInquiries,
  updateInquiryStatus,
  sendReply,
};
