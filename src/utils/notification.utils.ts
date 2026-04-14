import SiteSettings from "../modules/admin/models/site-settings.model";
import Notification from "../modules/notification/models/notification.model";
import { getIO } from "../socket";
import mailTransporter from "../config/mail";

interface AdminNotificationPayload {
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  relatedId?: string;
  relatedModel?: "Order" | "Contact" | "Product" | "User";
  category: "orderNotifications" | "customerNotifications" | "inventoryNotifications" | "marketingNotifications";
}

export const notifyAdmin = async (payload: AdminNotificationPayload) => {
  try {
    const settings = await SiteSettings.findOne();
    const notifications = settings?.notifications;

    // 1. Check if this category is enabled globally
    const isCategoryEnabled = notifications ? notifications[payload.category] : true;
    if (!isCategoryEnabled) {
      console.log(`Notification category ${payload.category} is disabled. Skipping.`);
      return;
    }

    // 2. Dashboard / Push Notification (Socket.io)
    const isPushEnabled = notifications?.pushNotifications ?? true;
    if (isPushEnabled) {
      const dbNotification = await Notification.create({
        title: payload.title,
        message: payload.message,
        type: payload.type,
        relatedId: payload.relatedId,
        relatedModel: payload.relatedModel,
      });

      const io = getIO();
      if (io) {
        io.to("admin_room").emit("new_notification", dbNotification);
        console.log(`[Socket] Push notification emitted: ${payload.title}`);
      }
    }

    // 3. Email Notification
    const isEmailEnabled = notifications?.emailNotifications ?? true;
    if (isEmailEnabled) {
      const targetEmail = notifications?.notificationEmail || settings?.adminEmail || process.env.MAIL_USER;

      if (targetEmail) {
        try {
          await mailTransporter.sendMail({
            from: process.env.MAIL_FROM || `"LuxeCart Admin" <${process.env.MAIL_USER}>`,
            to: targetEmail,
            subject: `Admin Alert: ${payload.title}`,
            html: `
              <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #4f46e5;">LuxeCart Admin Notification</h2>
                <p><strong>${payload.title}</strong></p>
                <p>${payload.message}</p>
                <hr />
                <p style="font-size: 12px; color: #666;">You received this because Email Notifications are enabled in your admin settings.</p>
              </div>
            `,
          });
          console.log(`[Email] Notification sent to ${targetEmail}`);
        } catch (emailError) {
          console.error("Failed to send admin notification email:", emailError);
        }
      }
    }

    // 4. SMS Notification (Simulation)
    const isSMSEnabled = notifications?.smsNotifications ?? false;
    if (isSMSEnabled) {
      const targetPhone = notifications?.notificationPhone;
      if (targetPhone) {
        console.log(`[SMS Simulation] SENT TO ${targetPhone}: ${payload.title} - ${payload.message}`);
      } else {
        console.warn("[SMS] SMS enabled but no notification phone number set.");
      }
    }

  } catch (error) {
    console.error("Critical error in notifyAdmin utility:", error);
  }
};
