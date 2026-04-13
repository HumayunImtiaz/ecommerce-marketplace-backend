import { Request, Response } from "express";
import Stripe from "stripe";
import nodemailer from "nodemailer";
import Order from "../models/order.model";
import Subscriber from "../../newsletter/models/subscriber.model";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);


const createTransporter = () =>
  nodemailer.createTransport({
    host: process.env.MAIL_HOST || "smtp.gmail.com",
    port: Number(process.env.MAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    tls: { rejectUnauthorized: false },
  });

const sendOrderConfirmationEmail = async (
  email: string,
  fullName: string,
  orderNumber: string,
  amount: number
) => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log("Mail transporter verified");

    await transporter.sendMail({
      from: process.env.MAIL_FROM || `"Ecommerce" <${process.env.MAIL_USER}>`,
      to: email,
      subject: ` Order Confirmed - ${orderNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h1 style="color: #1d4ed8;">Thank you, ${fullName}</h1>
          <p style="font-size: 16px; color: #374151;">Your payment of <strong>$${amount.toFixed(2)}</strong> was successful.</p>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; font-size: 18px; color: #166534;">Order Number: <strong>${orderNumber}</strong></p>
          </div>
          <p style="color: #6b7280;">We are now processing your order and will notify you when it ships.</p>
          <p style="color: #6b7280;">Thank you for shopping with us!</p>
        </div>
      `,
    });
    console.log(`✉️  Confirmation email sent to ${email}`);
  } catch (err: any) {
    console.error(` Email sending FAILED to ${email}:`, err.message);
  }
};

export const handleStripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

  console.log("-----------------------------------------");
  console.log(" STRIPE WEBHOOK RECEIVED");
  console.log("Headers:", JSON.stringify(req.headers, null, 2));
  console.log("Body exists:", !!req.body);
  console.log("Is body a Buffer?", Buffer.isBuffer(req.body));
  console.log("Secret length:", endpointSecret?.length);
  console.log("-----------------------------------------");

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig as string, endpointSecret);
  } catch (err: any) {
    console.error(`  Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const orderId = paymentIntent.metadata?.orderId;
        const amountPaid = paymentIntent.amount / 100;

        console.log(`payment_intent.succeeded — orderId: ${orderId}, intentId: ${paymentIntent.id}`);


        const order = orderId
          ? await Order.findById(orderId).populate<{ 
              userId: { 
                email: string; 
                fullName: string; 
                emailPreferences: { 
                  orderUpdates: boolean;
                  promotionalEmails: boolean;
                  productRecommendations: boolean;
                } 
              } 
            }>("userId", "email fullName emailPreferences")
          : await Order.findOne({ stripePaymentIntentId: paymentIntent.id }).populate<{ 
              userId: { 
                email: string; 
                fullName: string; 
                emailPreferences: { 
                  orderUpdates: boolean;
                  promotionalEmails: boolean;
                  productRecommendations: boolean;
                } 
              } 
            }>("userId", "email fullName emailPreferences");

        if (!order) {
          console.error(` No order found for orderId=${orderId} / intentId=${paymentIntent.id}`);
          break;
        }

        order.paymentStatus = "paid";
        order.orderStatus = "processing";
        order.stripePaymentIntentId = paymentIntent.id;
        await order.save();

        console.log(` Order ${order.orderNumber} → paid & processing`);

        if (order.userId?.email) {
          // Check if user is an active subscriber in the footer form
          const isSubscribed = await Subscriber.findOne({ email: order.userId.email.toLowerCase(), isActive: true });
          
          // Check user preference for order updates
          const preferenceEnabled = order.userId.emailPreferences?.orderUpdates !== false;

          if (isSubscribed && preferenceEnabled) {
            await sendOrderConfirmationEmail(
              order.userId.email,
              order.userId.fullName,
              order.orderNumber,
              amountPaid
            );
          } else {
            const reason = !isSubscribed ? "NOT SUBSCRIBED via footer" : "preference DISABLED in settings";
            console.log(`✉️  Order confirmation email SKIPPED for ${order.userId.email} because: ${reason}`);
          }
        } else {
          console.warn("  No email found on order userId — skipping email");
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const orderId = paymentIntent.metadata?.orderId;

        if (orderId) {
          await Order.findByIdAndUpdate(orderId, { paymentStatus: "failed", orderStatus: "cancelled" });
          console.log(` Order ${orderId} payment failed → cancelled`);
        } else {
          await Order.findOneAndUpdate({ stripePaymentIntentId: paymentIntent.id }, { paymentStatus: "failed", orderStatus: "cancelled" });
        }
        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error("Error processing webhook:", error.message);
    res.status(500).send("Webhook handler failed");
  }
};
