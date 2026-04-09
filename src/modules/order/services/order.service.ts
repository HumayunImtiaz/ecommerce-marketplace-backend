import Stripe from "stripe";
import Order from "../models/order.model";
import { z } from "zod";

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
});

// Create Stripe Payment Intent 
export const createPaymentIntentService = async (
  amount: number
): Promise<ServiceResponse<{ clientSecret: string }>> => {
  try {
    if (!amount || amount <= 0) {
      return { success: false, statusCode: 400, message: "Invalid amount", data: null };
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // cents mein
      currency: "usd",
      automatic_payment_methods: { enabled: true },
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
        },
      });

      order.stripePaymentIntentId = paymentIntent.id;
      clientSecret = paymentIntent.client_secret || undefined;
    }

    await order.save();

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
    const order = await Order.findById(orderId);
    if (!order) {
      return { success: false, statusCode: 404, message: "Order not found", data: null };
    }

    order.orderStatus = status as any;
    
    // Auto mark as paid if they manually select delivered or mark completed
    if (status === "delivered" && order.paymentMethod === "cod") {
      order.paymentStatus = "paid";
    }

    await order.save();

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

    console.log(`✅ Order ${order.orderNumber} confirmed via frontend callback → paid & processing`);

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