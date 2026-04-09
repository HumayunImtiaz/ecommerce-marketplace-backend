import Subscriber from "../models/subscriber.model";
import mailTransporter from "../../../config/mail";

type ServiceResponse<T = unknown> = {
  success: boolean;
  statusCode: number;
  message: string;
  data: T | null;
};


export const subscribeService = async (
  email: string
): Promise<ServiceResponse> => {
  try {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return {
        success: false,
        statusCode: 400,
        message: "Please provide a valid email address",
        data: null,
      };
    }

    const existing = await Subscriber.findOne({ email: email.toLowerCase() });

    if (existing) {
      if (existing.isActive) {
        return {
          success: false,
          statusCode: 409,
          message: "This email is already subscribed",
          data: null,
        };
      }
      // Re-activate
      existing.isActive = true;
      existing.unsubscribedAt = null;
      existing.subscribedAt = new Date();
      await existing.save();
      return {
        success: true,
        statusCode: 200,
        message: "Welcome back! You have been re-subscribed successfully",
        data: existing,
      };
    }

    const subscriber = new Subscriber({ email: email.toLowerCase() });
    await subscriber.save();

    return {
      success: true,
      statusCode: 201,
      message: "Subscribed successfully! You'll receive updates on new products and deals.",
      data: subscriber,
    };
  } catch (error: any) {
    console.error("subscribeService error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Failed to subscribe. Please try again later.",
      data: null,
    };
  }
};

// ─── Unsubscribe ──────────────────────────────────────────────────────────────
export const unsubscribeService = async (
  email: string
): Promise<ServiceResponse> => {
  try {
    if (!email) {
      return {
        success: false,
        statusCode: 400,
        message: "Email is required",
        data: null,
      };
    }

    const subscriber = await Subscriber.findOne({
      email: email.toLowerCase(),
    });

    if (!subscriber || !subscriber.isActive) {
      return {
        success: false,
        statusCode: 404,
        message: "This email is not subscribed",
        data: null,
      };
    }

    subscriber.isActive = false;
    subscriber.unsubscribedAt = new Date();
    await subscriber.save();

    return {
      success: true,
      statusCode: 200,
      message: "You have been unsubscribed successfully",
      data: null,
    };
  } catch (error: any) {
    console.error("unsubscribeService error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Failed to unsubscribe",
      data: null,
    };
  }
};

// ─── Notify All Active Subscribers ────────────────────────────────────────────
export const notifySubscribersService = async (product: any): Promise<void> => {
  try {
    const subscribers = await Subscriber.find({ isActive: true });

    if (subscribers.length === 0) {
      console.log("No active subscribers to notify.");
      return;
    }

    const clientUrl = (process.env.CLIENT_URL || "http://localhost:3000").replace(/\/$/, "");
    const serverUrl = (process.env.SERVER_URL || "http://localhost:5000").replace(/\/$/, "");

    const productUrl = `${clientUrl}/products/${product.slug}`;

    // Build absolute image URL for email clients
    let productImage = "";
    if (product.images && product.images.length > 0) {
      const img = product.images[0];
      if (img.startsWith("http")) {
        productImage = img;
      } else {
        // Ensure relative path starts with a single /
        const normalizedImg = img.startsWith("/") ? img : `/${img}`;
        productImage = `${serverUrl}${normalizedImg}`;
      }
    }

    // DEBUG: Log URLs to see exactly what is being sent in the email
    console.log("--- Newsletter Debug ---");
    console.log("Product Name:", product.name);
    console.log("Product Slug:", product.slug);
    console.log("Product URL (Link):", productUrl);
    console.log("Product Image (Src):", productImage);
    console.log("-------------------------");
    const hasDiscount =
      product.comparePrice && product.comparePrice > product.price;
    const discountPercent = hasDiscount
      ? Math.round(
        ((product.comparePrice - product.price) / product.comparePrice) * 100
      )
      : 0;

    const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <div style="max-width:600px; margin:0 auto; background-color:#ffffff;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 30px 20px; text-align: center;">
      <h1 style="color:#ffffff; margin:0; font-size:24px;">New Product Alert!</h1>
      <p style="color:#dbeafe; margin:8px 0 0;">Something amazing just dropped</p>
    </div>

    <!-- Product Card -->
    <div style="padding: 30px 20px;">
    
      
      <h2 style="color:#1f2937; margin:0 0 10px; font-size:22px;">${product.name}</h2>
      
      ${product.description ? `<p style="color:#6b7280; margin:0 0 16px; font-size:14px; line-height:1.6;">${product.description.substring(0, 200)}${product.description.length > 200 ? "..." : ""}</p>` : ""}
      
      <div style="margin: 16px 0;">
        <span style="font-size:28px; font-weight:bold; color:#3b82f6;">$${product.price}</span>
        ${hasDiscount
        ? `<span style="font-size:16px; color:#9ca3af; text-decoration:line-through; margin-left:10px;">$${product.comparePrice}</span>
               <span style="background:#fef2f2; color:#ef4444; padding:4px 10px; border-radius:20px; font-size:12px; font-weight:600; margin-left:8px;">${discountPercent}% OFF</span>`
        : ""
      }
      </div>

      <div style="text-align:center; margin-top:24px;">
        <a href="${productUrl}" style="display:inline-block; background:linear-gradient(135deg, #3b82f6, #8b5cf6); color:#ffffff; text-decoration:none; padding:14px 40px; border-radius:10px; font-weight:600; font-size:16px;">
          Shop Now →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color:#f9fafb; padding:20px; text-align:center; border-top:1px solid #e5e7eb;">
      <p style="color:#9ca3af; font-size:12px; margin:0;">
        You received this email because you subscribed to our newsletter.<br/>
        <a href="${clientUrl}/unsubscribe?email=__EMAIL__" style="color:#3b82f6;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`;

    const fromAddress = process.env.MAIL_FROM || process.env.MAIL_USER;

    // Send emails in batches of 10
    const batchSize = 10;
    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);
      const emailPromises = batch.map((subscriber) => {
        const personalizedHtml = htmlTemplate.replace(
          /__EMAIL__/g,
          encodeURIComponent(subscriber.email)
        );

        return mailTransporter
          .sendMail({
            from: fromAddress,
            to: subscriber.email,
            subject: hasDiscount
              ? ` ${discountPercent}% OFF — ${product.name} just dropped!`
              : ` New Arrival — ${product.name} is here!`,
            html: personalizedHtml,
          })
          .catch((err) => {
            console.error(
              `Failed to send email to ${subscriber.email}:`,
              err.message
            );
          });
      });

      await Promise.allSettled(emailPromises);
    }

    console.log(
      `Newsletter sent to ${subscribers.length} subscriber(s) for product: ${product.name}`
    );
  } catch (error: any) {
    console.error("notifySubscribersService error:", error.message);
  }
};
