import Stripe from "stripe";
import Order from "../models/order.model";
import Coupon from "../models/coupon.model";
import { syncStripeRedemption } from "./coupon.service";
import Notification from "../../notification/models/notification.model";
import Product from "../../product/models/product.model";
import Variant from "../../product/models/variant.model";
import Stock from "../../product/models/stock.model";
import { getIO } from "../../../socket";
import { z } from "zod";
import mongoose from "mongoose";
import Subscriber from "../../newsletter/models/subscriber.model";
import mailTransporter from "../../../config/mail";
import { notifyAdmin } from "../../../utils/notification.utils";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

type ServiceResponse<T = unknown> = {
  success: boolean;
  statusCode: number;
  message: string;
  data: T | null;
  errors?: { field: string; message: string }[];
};

// Order number generate 
const generateOrderNumber = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substr(2, 5).toUpperCase();
  return `ORD-${timestamp}-${random}`;
};

const addressSchema = z.object({
  name: z.string().min(1, "Name is required"),
  street: z.string().min(1, "Street is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().min(1, "ZIP code is required"),
  country: z.string().min(1, "Country is required"),
});

const orderItemSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1),
  image: z.string().optional().default(""),
  price: z.number().min(0),
  quantity: z.number().int().min(1),
  selectedColor: z.string().optional(),
  selectedSize: z.string().optional(),
});

const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, "Order must have at least one item"),
  shippingAddress: addressSchema,
  billingAddress: addressSchema,
  subtotal: z.number().min(0),
  tax: z.number().min(0),
  shippingCost: z.number().min(0),
  total: z.number().min(0),
  paymentMethod: z.enum(["stripe", "cod"]),
  stripePaymentIntentId: z.string().optional(),
  couponCode: z.string().optional(),
  discountAmount: z.number().optional().default(0),
});

// Create Stripe Payment Intent
export const createPaymentIntentService = async (
  amount: number,
  couponCode?: string
): Promise<ServiceResponse<{ clientSecret: string }>> => {
  try {
    if (!amount || amount <= 0) {
      return { success: false, statusCode: 400, message: "Invalid amount", data: null };
    }

    const metadata: Record<string, string> = {}
    if (couponCode) metadata.couponCode = couponCode.toUpperCase()

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata,
      description: couponCode ? `Coupon applied: ${couponCode.toUpperCase()}` : undefined,
    });

    return {
      success: true,
      statusCode: 200,
      message: "Payment intent created",
      data: { clientSecret: paymentIntent.client_secret! },
    };
  } catch (error: any) {
    console.error("createPaymentIntentService error:", error);
    return { success: false, statusCode: 500, message: error.message || "Failed to create payment intent", data: null };
  }
};

// Create Order
export const createOrderService = async (
  userId: string,
  body: any
): Promise<ServiceResponse> => {
  try {
    const validation = createOrderSchema.safeParse(body);
    if (!validation.success) {
      const fieldErrors = validation.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }));
      return {
        success: false,
        statusCode: 400,
        message: `Validation failed: ${fieldErrors.map((e) => e.message).join(", ")}`,
        data: null,
        errors: fieldErrors,
      };
    }

    const data = validation.data;

    const order = new Order({
      userId,
      orderNumber: generateOrderNumber(),
      items: data.items.map((item: any) => ({
        productId: item.productId,
        name: item.name,
        image: item.image,
        price: item.price,
        quantity: item.quantity,
        selectedColor: item.selectedColor,
        selectedSize: item.selectedSize,
      })),
      shippingAddress: data.shippingAddress,
      billingAddress: data.billingAddress,
      subtotal: data.subtotal,
      tax: data.tax,
      shippingCost: data.shippingCost,
      total: data.total,
      paymentMethod: data.paymentMethod,
      couponCode: data.couponCode,
      discountAmount: data.discountAmount,
      paymentStatus: "pending",
      orderStatus: "pending",
    });

    let clientSecret: string | undefined = undefined;

    if (data.paymentMethod === "stripe") {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(data.total * 100),
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        metadata: {
          orderId: order._id.toString(),
          ...(data.couponCode ? { couponCode: data.couponCode.toUpperCase(), originalSubtotal: data.subtotal.toString(), discountAmount: (data.discountAmount || 0).toString() } : {})
        },
        description: data.couponCode ? `Order with coupon: ${data.couponCode.toUpperCase()}` : undefined,
      });

      order.stripePaymentIntentId = paymentIntent.id;
      clientSecret = paymentIntent.client_secret || undefined;
    }

    await order.save();

    // Update Coupon usage if applied
    if (data.couponCode) {
      const coupon = await Coupon.findOne({ code: data.couponCode.toUpperCase() });
      if (coupon) {
        coupon.usedCount += 1;
        const userUsageIndex = coupon.usedBy.findIndex(u => u.userId.toString() === userId);
        if (userUsageIndex > -1) {
          coupon.usedBy[userUsageIndex].count += 1;
        } else {
          coupon.usedBy.push({ userId: new mongoose.Types.ObjectId(userId) as any, count: 1 });
        }
        await coupon.save();

        // Sync redemption count to Stripe (non-blocking, non-fatal)
        syncStripeRedemption(userId, data.couponCode).catch((e) =>
          console.error("Stripe redemption sync failed silently:", e.message)
        );
      }
    }

    // Deduct stock and check low stock threshold
    for (const item of data.items) {
      let variantQuery: any = { productId: item.productId };
      if (item.selectedColor) variantQuery.color = item.selectedColor;
      if (item.selectedSize) variantQuery.size = item.selectedSize;

      let variant = await Variant.findOne(variantQuery);
      if (!variant && item.selectedColor) {
        variant = await Variant.findOne({ productId: item.productId, color: item.selectedColor });
      }
      if (!variant) {
        variant = await Variant.findOne({ productId: item.productId });
      }

      if (variant) {
        const stock = await Stock.findOne({ variantId: variant._id });
        if (stock) {
          stock.quantity = Math.max(0, stock.quantity - item.quantity);
          await stock.save();

          // Low Stock Alert (Unified)
          if (stock.quantity <= stock.lowStockThreshold) {
            const product = await Product.findById(item.productId);
            const variantDetails = [item.selectedColor, item.selectedSize].filter(Boolean).join(" - ");
            
            await notifyAdmin({
              title: "Low Stock Alert",
              message: `Product "${product?.name || item.name}" ${variantDetails ? `(${variantDetails})` : ""} is low on stock (${stock.quantity} left).`,
              type: "warning",
              relatedId: product?.slug || item.productId.toString(),
              relatedModel: "Product",
              category: "inventoryNotifications",
            });
          }
        }
      }
    }

    // New Order Alert (Unified)
    await notifyAdmin({
      title: "New Order",
      message: `Order ${order.orderNumber} placed.`,
      type: "success",
      relatedId: order._id.toString(),
      relatedModel: "Order",
      category: "orderNotifications",
    });

    return {
      success: true,
      statusCode: 201,
      message: data.paymentMethod === "cod"
        ? "Order placed successfully! Pay on delivery."
        : "Order placed. Please complete the payment.",
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        total: order.total,
        paymentMethod: order.paymentMethod,
        orderStatus: order.orderStatus,
        clientSecret,
        stripePaymentIntentId: order.stripePaymentIntentId,
      },
    };
  } catch (error: any) {
    console.error("createOrderService error:", error);
    return { success: false, statusCode: 500, message: `Failed to create order: ${error.message}`, data: null };
  }
};

//  Get User Orders 
export const getUserOrdersService = async (
  userId: string
): Promise<ServiceResponse> => {
  try {
    const orders = await Order.find({ userId }).sort({ createdAt: -1 });
    return {
      success: true,
      statusCode: 200,
      message: "Orders fetched successfully",
      data: orders.map((o: any) => ({
        id: o._id, ...o._doc, _id: undefined
      })),
    };
  } catch (error: any) {
    return { success: false, statusCode: 500, message: `Failed to fetch orders: ${error.message}`, data: null };
  }
};

// Get All Orders (Admin)
export const getAllOrdersService = async (): Promise<ServiceResponse> => {
  try {
    const orders = await Order.find()
      .populate("userId", "fullName email")
      .sort({ createdAt: -1 });
    return {
      success: true,
      statusCode: 200,
      message: "All orders fetched successfully",
      data: orders.map((o: any) => {
        const orderObj = o.toObject();
        return {
          id: o._id.toString(),
          ...orderObj,
          _id: undefined
        };
      }),
    };
  } catch (error: any) {
    return { success: false, statusCode: 500, message: `Failed to fetch all orders: ${error.message}`, data: null };
  }
};

// Get Single Order by ID (Admin)
export const getOrderByIdService = async (orderId: string): Promise<ServiceResponse> => {
  try {
    const order = await Order.findById(orderId)
      .populate("userId", "fullName email phone")
      .lean();
    if (!order) {
      return { success: false, statusCode: 404, message: "Order not found", data: null };
    }
    return {
      success: true,
      statusCode: 200,
      message: "Order fetched",
      data: { ...order, id: (order as any)._id?.toString() }
    };
  } catch (error: any) {
    return { success: false, statusCode: 500, message: `Failed to fetch order: ${error.message}`, data: null };
  }
};

// Update Order Status (Admin)
export const updateOrderStatusService = async (
  orderId: string,
  status: string
): Promise<ServiceResponse> => {
  try {
    const order = await Order.findById(orderId).populate<{
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
      return { success: false, statusCode: 404, message: "Order not found", data: null };
    }

    order.orderStatus = status as any;

    // Auto mark as paid if they manually select delivered or mark completed
    if (status === "delivered" && order.paymentMethod === "cod") {
      order.paymentStatus = "paid";
    }

    await order.save();

    // Unified Admin Alert (Order Status Update)
    await notifyAdmin({
      title: "Order Status Updated",
      message: `Order ${order.orderNumber} is now ${status.toUpperCase()}.`,
      type: "info",
      relatedId: order._id.toString(),
      relatedModel: "Order",
      category: "orderNotifications",
    });

    // --- Send Email Notification if prerequisites are met ---
    if (order.userId?.email) {
      const isSubscribed = await Subscriber.findOne({ email: order.userId.email.toLowerCase(), isActive: true });
      const prefs = order.userId.emailPreferences;

      // 1. Order Status Email (Already implemented)
      if (isSubscribed && prefs?.orderUpdates !== false) {
        await sendOrderStatusUpdateEmail(order.userId.email, order.userId.fullName, order.orderNumber, status);
      }

      // 2. Product Recommendations (New: Trigger on delivery)
      if (status.toLowerCase() === "delivered" && isSubscribed && prefs?.productRecommendations === true) {
        await sendProductRecommendationsEmail(order);
      }
    }

    return {
      success: true,
      statusCode: 200,
      message: "Order status updated successfully",
      data: { ...order.toObject(), id: order._id.toString() },
    };
  } catch (error: any) {
    return { success: false, statusCode: 500, message: `Failed to update status: ${error.message}`, data: null };
  }
};

const sendOrderStatusUpdateEmail = async (
  email: string,
  fullName: string,
  orderNumber: string,
  status: string
) => {
  try {
    const statusLabels: Record<string, string> = {
      processing: "is now being processed",
      shipped: "has been shipped",
      delivered: "has been delivered",
      cancelled: "has been cancelled",
    };

    const statusMessage = statusLabels[status.toLowerCase()] || `status has been updated to ${status}`;

    await mailTransporter.sendMail({
      from: process.env.MAIL_FROM || `"Ecommerce" <${process.env.MAIL_USER}>`,
      to: email,
      subject: `Order Update: ${orderNumber} - ${status.toUpperCase()}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 24px;">Order Update</h1>
            <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Order Number: ${orderNumber}</p>
          </div>
          
          <div style="padding: 24px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 24px;">
            <p style="font-size: 16px; color: #1e293b; margin: 0;">
              Hello <strong>${fullName}</strong>,
            </p>
            <p style="font-size: 16px; color: #334155; line-height: 1.6; margin-top: 12px;">
              Your order <strong>${orderNumber}</strong> ${statusMessage}.
            </p>
          </div>
          
          <div style="text-align: center;">
            <a href="${process.env.CLIENT_URL}/account?tab=orders" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
              View Order History
            </a>
          </div>
          
          <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 32px;">
            Thank you for shopping with us!<br/>
            If you did not expect this email, please ignore it.
          </p>
        </div>
      `,
    });
    console.log(`✉️  Order status (${status}) email sent to ${email}`);
  } catch (err: any) {
    console.error(`Email sending FAILED to ${email}:`, err.message);
  }
};

const sendProductRecommendationsEmail = async (order: any) => {
  try {
    const purchasedProductIds = order.items.map((item: any) => item.productId.toString());

    // Get categories from purchased products
    const purchasedProducts = await Product.find({ _id: { $in: order.items.map((item: any) => item.productId) } });
    const categoryIds = [...new Set(purchasedProducts.map(p => p.categoryId.toString()))];

    // Find recommended products: same category, active, not the ones just bought
    const recommendations = await Product.find({
      categoryId: { $in: categoryIds },
      _id: { $nin: purchasedProductIds },
      isActive: true
    }).limit(4);

    if (recommendations.length === 0) {
      console.log("No related recommendations found for order:", order.orderNumber);
      return;
    }

    const clientUrl = (process.env.CLIENT_URL || "http://localhost:3000").replace(/\/$/, "");
    const serverUrl = (process.env.SERVER_URL || "http://localhost:5000").replace(/\/$/, "");

    const productsHtml = recommendations.map(p => {
      const productUrl = `${clientUrl}/products/${p.slug}`;
      const imageUrl = p.images?.[0]?.startsWith("http") ? p.images[0] : `${serverUrl}/${p.images?.[0]?.replace(/^\/+/, "")}`;

      return `
        <div style="flex: 1; min-width: 200px; margin: 10px; padding: 16px; border: 1px solid #f1f5f9; border-radius: 12px; text-align: center;">
          <img src="${imageUrl}" alt="${p.name}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; margin-bottom: 12px;" />
          <h4 style="margin: 0; color: #1e293b; font-size: 16px;">${p.name}</h4>
          <p style="color: #2563eb; font-weight: bold; margin: 8px 0;">$${p.price}</p>
          <a href="${productUrl}" style="display: inline-block; background-color: #f1f5f9; color: #1e293b; text-decoration: none; padding: 6px 16px; border-radius: 6px; font-size: 12px; font-weight: 500;">View Details</a>
        </div>
      `;
    }).join("");

    await mailTransporter.sendMail({
      from: process.env.MAIL_FROM || `"Ecommerce" <${process.env.MAIL_USER}>`,
      to: order.userId.email,
      subject: `Recommended for you! — Based on your recent order #${order.orderNumber}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; background-color: #ffffff;">
          <h2 style="color: #1e293b; text-align: center;">You might also like...</h2>
          <p style="color: #64748b; text-align: center; margin-bottom: 32px;">We hope you enjoy your recent purchase! Based on what you bought, we thought you might find these interesting:</p>
          
          <div style="display: flex; flex-wrap: wrap; justify-content: center;">
            ${productsHtml}
          </div>
          
          <div style="text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #f1f5f9;">
            <p style="color: #94a3b8; font-size: 12px;">You are receiving this because you enabled Product Recommendations in your account.</p>
          </div>
        </div>
      `,
    });

    console.log(` Product recommendations email sent to ${order.userId.email}`);
  } catch (err: any) {
    console.error("sendProductRecommendationsEmail error:", err.message);
  }
};

// Confirm Stripe Payment (called from frontend after paymentIntent succeeds)
export const confirmOrderPaymentService = async (
  orderId: string,
  paymentIntentId: string,
  userId: string
): Promise<ServiceResponse> => {
  try {
    // Find order belonging to this user
    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return { success: false, statusCode: 404, message: "Order not found", data: null };
    }

    // Already paid — idempotent
    if (order.paymentStatus === "paid") {
      return {
        success: true,
        statusCode: 200,
        message: "Payment already confirmed",
        data: { orderStatus: order.orderStatus, paymentStatus: order.paymentStatus },
      };
    }

    // Verify intent directly with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== "succeeded") {
      return {
        success: false,
        statusCode: 400,
        message: `PaymentIntent status is "${paymentIntent.status}", not succeeded`,
        data: null,
      };
    }

    // Update order
    order.paymentStatus = "paid";
    order.orderStatus = "processing";
    order.stripePaymentIntentId = paymentIntentId;
    await order.save();

    console.log(` Order ${order.orderNumber} confirmed via frontend callback → paid & processing`);

    return {
      success: true,
      statusCode: 200,
      message: "Payment confirmed successfully",
      data: { orderStatus: "processing", paymentStatus: "paid", orderNumber: order.orderNumber },
    };
  } catch (error: any) {
    console.error("confirmOrderPaymentService error:", error);
    return { success: false, statusCode: 500, message: `Failed to confirm payment: ${error.message}`, data: null };
  }
};