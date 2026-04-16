import Stripe from "stripe";
import prisma from "../../../config/prisma";
import { syncStripeRedemption } from "./coupon.service";
import { getIO } from "../../../socket";
import { z } from "zod";
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

// Helper to flatten addresses for frontend
const formatOrderResponse = (order: any) => {
  if (!order) return null;
  const result = { ...order };
  if (Array.isArray(order.addresses)) {
    result.shippingAddress = order.addresses.find((a: any) => a.type === "shipping");
    result.billingAddress = order.addresses.find((a: any) => a.type === "billing");
  }
  return result;
};

// Deduct Stock Helper
// Deduct Stock Helper - now idempotent and robust
export const deductOrderStock = async (orderId: string) => {
  console.log(`[Inventory] Starting stock deduction for order: ${orderId}`);
  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) {
        console.warn(`[Inventory] Order ${orderId} not found`);
        return;
      }
      if (order.inventoryUpdated) {
        console.log(`[Idempotency] Stock already deducted for order: ${order.orderNumber}`);
        return;
      }

      for (const item of order.items) {
        console.log(`[Inventory] Processing item: ${item.name} (${item.productId})`);
        
        // Build dynamic filter with case-insensitive matching
        const variantWhere: any = { productId: item.productId };
        if (item.selectedColor) {
          variantWhere.color = { equals: item.selectedColor, mode: 'insensitive' };
        }
        if (item.selectedSize) {
          variantWhere.size = { equals: item.selectedSize, mode: 'insensitive' };
        }

        let variant = await tx.variant.findFirst({ where: variantWhere });
        
        // Fallback 1: Match by color only (if size failed)
        if (!variant && item.selectedColor) {
           console.log(`[Inventory] Exact match failed, trying color-only fallback for: ${item.selectedColor}`);
          variant = await tx.variant.findFirst({
            where: { 
              productId: item.productId, 
              color: { equals: item.selectedColor, mode: 'insensitive' } 
            },
          });
        }
        
        // Fallback 2: Take first available variant
        if (!variant) {
          console.log(`[Inventory] Color-only failed, taking first available variant for product`);
          variant = await tx.variant.findFirst({ where: { productId: item.productId } });
        }

        if (variant) {
          console.log(`[Inventory] Found variant: ${variant.id} (Color: ${variant.color}, Size: ${variant.size})`);
          const stock = await tx.stock.findFirst({ where: { variantId: variant.id } });
          if (stock) {
            const oldQty = stock.quantity;
            const newQty = Math.max(0, oldQty - item.quantity);
            let newStatus = "in_stock";
            if (newQty <= 0) newStatus = "out_of_stock";
            else if (newQty <= stock.lowStockThreshold) newStatus = "low_stock";

            await tx.stock.update({
              where: { id: stock.id },
              data: { quantity: newQty, status: newStatus },
            });
            
            console.log(`[Inventory] ✅ Updated Stock for ${item.name}: ${oldQty} -> ${newQty}`);

            // Low Stock Alert
            if (newQty <= stock.lowStockThreshold) {
              const product = await tx.product.findUnique({ where: { id: item.productId } });
              const variantDetails = [item.selectedColor, item.selectedSize].filter(Boolean).join(" - ");
              await notifyAdmin({
                title: "Low Stock Alert",
                message: `Product "${product?.name || item.name}" ${variantDetails ? `(${variantDetails})` : ""} is low on stock (${newQty} left).`,
                type: "warning",
                relatedId: product?.slug || item.productId,
                relatedModel: "Product",
                category: "inventoryNotifications",
              });
            }
          } else {
            console.error(`[Inventory] ❌ No stock record found for variant: ${variant.id}`);
          }
        } else {
          console.error(`[Inventory] ❌ No variant record found for productId: ${item.productId}`);
        }
      }

      // Mark as updated
      await tx.order.update({
        where: { id: orderId },
        data: { inventoryUpdated: true },
      });

      console.log(`✅ [Inventory] Complete deduction for order: ${order.orderNumber}`);
    });
  } catch (error: any) {
    console.error(`[Inventory] ❌ Error during deduction for ${orderId}:`, error.message);
  }
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

    const metadata: Record<string, string> = {};
    if (couponCode) metadata.couponCode = couponCode.toUpperCase();

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
    const orderNumber = generateOrderNumber();

    let stripePaymentIntentId: string | undefined;
    let clientSecret: string | undefined;

    if (data.paymentMethod === "stripe") {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(data.total * 100),
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        metadata: {
          userId,
          ...(data.couponCode
            ? {
                couponCode: data.couponCode.toUpperCase(),
                originalSubtotal: data.subtotal.toString(),
                discountAmount: (data.discountAmount || 0).toString(),
              }
            : {}),
        },
        description: data.couponCode
          ? `Order with coupon: ${data.couponCode.toUpperCase()}`
          : undefined,
      });
      stripePaymentIntentId = paymentIntent.id;
      clientSecret = paymentIntent.client_secret || undefined;
    }

    // Create order with its items and addresses in a single transaction
    const order = await prisma.order.create({
      data: {
        userId,
        orderNumber,
        subtotal: data.subtotal,
        tax: data.tax,
        shippingCost: data.shippingCost,
        total: data.total,
        paymentMethod: data.paymentMethod,
        paymentStatus: "pending",
        orderStatus: "pending",
        stripePaymentIntentId: stripePaymentIntentId,
        couponCode: data.couponCode,
        discountAmount: data.discountAmount || 0,
        items: {
          create: data.items.map((item: any) => ({
            productId: item.productId,
            name: item.name,
            image: item.image || "",
            price: item.price,
            quantity: item.quantity,
            selectedColor: item.selectedColor,
            selectedSize: item.selectedSize,
          })),
        },
        addresses: {
          create: [
            { type: "shipping", ...data.shippingAddress },
            { type: "billing", ...data.billingAddress },
          ],
        },
      },
    });

    // If Stripe, update the Payment Intent with the Order ID for better webhook tracking
    if (data.paymentMethod === "stripe" && stripePaymentIntentId) {
      await stripe.paymentIntents.update(stripePaymentIntentId, {
        metadata: { orderId: order.id },
      }).catch(e => console.error("Failed to update PI metadata:", e.message));
    }

    // Update Coupon usage if applied
    if (data.couponCode) {
      const coupon = await prisma.coupon.findFirst({
        where: { code: data.couponCode.toUpperCase() },
      });
      if (coupon) {
        await prisma.coupon.update({
          where: { id: coupon.id },
          data: { usedCount: { increment: 1 } },
        });

        // Upsert user usage record
        await prisma.couponUsage.upsert({
          where: { couponId_userId: { couponId: coupon.id, userId } },
          update: { count: { increment: 1 } },
          create: { couponId: coupon.id, userId, count: 1 },
        });

        // Sync redemption count to Stripe (non-blocking, non-fatal)
        syncStripeRedemption(userId, data.couponCode).catch((e) =>
          console.error("Stripe redemption sync failed silently:", e.message)
        );
      }
    }

    // Deduct stock immediately ONLY if COD
    if (data.paymentMethod === "cod") {
      await deductOrderStock(order.id);
    }

    // New Order Alert
    await notifyAdmin({
      title: "New Order",
      message: `Order ${order.orderNumber} placed.`,
      type: "success",
      relatedId: order.id,
      relatedModel: "Order",
      category: "orderNotifications",
    });

    return {
      success: true,
      statusCode: 201,
      message:
        data.paymentMethod === "cod"
          ? "Order placed successfully! Pay on delivery."
          : "Order placed. Please complete the payment.",
      data: {
        orderId: order.id,
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

// Get User Orders
export const getUserOrdersService = async (
  userId: string
): Promise<ServiceResponse> => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        items: true,
        addresses: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return {
      success: true,
      statusCode: 200,
      message: "Orders fetched successfully",
      data: orders.map(formatOrderResponse),
    };
  } catch (error: any) {
    return { success: false, statusCode: 500, message: `Failed to fetch orders: ${error.message}`, data: null };
  }
};

// Get All Orders (Admin)
export const getAllOrdersService = async (): Promise<ServiceResponse> => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        user: { select: { fullName: true, email: true } },
        items: true,
        addresses: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return {
      success: true,
      statusCode: 200,
      message: "All orders fetched successfully",
      data: orders.map(formatOrderResponse),
    };
  } catch (error: any) {
    return { success: false, statusCode: 500, message: `Failed to fetch all orders: ${error.message}`, data: null };
  }
};

// Get Single Order by ID (Admin)
export const getOrderByIdService = async (orderId: string): Promise<ServiceResponse> => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { fullName: true, email: true, phone: true } },
        items: true,
        addresses: true,
      },
    });
    if (!order) {
      return { success: false, statusCode: 404, message: "Order not found", data: null };
    }
    return { success: true, statusCode: 200, message: "Order fetched", data: formatOrderResponse(order) };
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
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: {
            email: true,
            fullName: true,
            prefOrderUpdates: true,
            prefProductRecommendations: true,
          },
        },
        items: true,
      },
    });
    if (!order) {
      return { success: false, statusCode: 404, message: "Order not found", data: null };
    }

    const updateData: any = { orderStatus: status };

    // Auto mark as paid if COD delivered
    if (status === "delivered" && order.paymentMethod === "cod") {
      updateData.paymentStatus = "paid";
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
    });

    // Admin notification
    await notifyAdmin({
      title: "Order Status Updated",
      message: `Order ${order.orderNumber} is now ${status.toUpperCase()}.`,
      type: "info",
      relatedId: order.id,
      relatedModel: "Order",
      category: "orderNotifications",
    });

    // Send email notification if prerequisites are met
    if (order.user?.email) {
      const isSubscribed = await prisma.subscriber.findFirst({
        where: { email: order.user.email.toLowerCase(), isActive: true },
      });

      if (isSubscribed && order.user.prefOrderUpdates !== false) {
        await sendOrderStatusUpdateEmail(
          order.user.email,
          order.user.fullName,
          order.orderNumber,
          status
        );
      }

      // Product recommendations on delivery
      if (
        status.toLowerCase() === "delivered" &&
        isSubscribed &&
        order.user.prefProductRecommendations === true
      ) {
        await sendProductRecommendationsEmail(order);
      }
    }

    return {
      success: true,
      statusCode: 200,
      message: "Order status updated successfully",
      data: formatOrderResponse(updatedOrder),
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

    const statusMessage =
      statusLabels[status.toLowerCase()] || `status has been updated to ${status}`;

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
    const purchasedProductIds = order.items.map((item: any) => item.productId);

    // Get categories from purchased products
    const purchasedProducts = await prisma.product.findMany({
      where: { id: { in: purchasedProductIds } },
      select: { categoryId: true },
    });
    const categoryIds = [...new Set(purchasedProducts.map((p) => p.categoryId))];

    // Find recommended products: same category, active, not the ones just bought
    const recommendations = await prisma.product.findMany({
      where: {
        categoryId: { in: categoryIds },
        id: { notIn: purchasedProductIds },
        isActive: true,
      },
      take: 4,
    });

    if (recommendations.length === 0) {
      console.log("No related recommendations found for order:", order.orderNumber);
      return;
    }

    const clientUrl = (process.env.CLIENT_URL || "http://localhost:3000").replace(/\/$/, "");
    const serverUrl = (process.env.SERVER_URL || "http://localhost:5000").replace(/\/$/, "");

    const productsHtml = recommendations
      .map((p) => {
        const productUrl = `${clientUrl}/products/${p.slug}`;
        const imageUrl =
          p.images?.[0]?.startsWith("http")
            ? p.images[0]
            : `${serverUrl}/${p.images?.[0]?.replace(/^\/+/, "")}`;

        return `
        <div style="flex: 1; min-width: 200px; margin: 10px; padding: 16px; border: 1px solid #f1f5f9; border-radius: 12px; text-align: center;">
          <img src="${imageUrl}" alt="${p.name}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; margin-bottom: 12px;" />
          <h4 style="margin: 0; color: #1e293b; font-size: 16px;">${p.name}</h4>
          <p style="color: #2563eb; font-weight: bold; margin: 8px 0;">$${p.price}</p>
          <a href="${productUrl}" style="display: inline-block; background-color: #f1f5f9; color: #1e293b; text-decoration: none; padding: 6px 16px; border-radius: 6px; font-size: 12px; font-weight: 500;">View Details</a>
        </div>
      `;
      })
      .join("");

    await mailTransporter.sendMail({
      from: process.env.MAIL_FROM || `"Ecommerce" <${process.env.MAIL_USER}>`,
      to: order.user.email,
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

    console.log(` Product recommendations email sent to ${order.user.email}`);
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
    const order = await prisma.order.findFirst({ where: { id: orderId, userId } });
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

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: "paid",
        orderStatus: "processing",
        stripePaymentIntentId: paymentIntentId,
      },
    });

    // Deduct stock on payment completion
    await deductOrderStock(order.id);

    console.log(` Order ${updatedOrder.orderNumber} confirmed via frontend callback → paid & processing`);

    return {
      success: true,
      statusCode: 200,
      message: "Payment confirmed successfully",
      data: {
        orderStatus: "processing",
        paymentStatus: "paid",
        orderNumber: updatedOrder.orderNumber,
      },
    };
  } catch (error: any) {
    console.error("confirmOrderPaymentService error:", error);
    return { success: false, statusCode: 500, message: `Failed to confirm payment: ${error.message}`, data: null };
  }
};