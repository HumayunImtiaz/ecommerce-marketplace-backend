import { Schema, model, Model, Types } from "mongoose";

export interface IOrderItem {
  productId: Types.ObjectId;
  name: string;
  image: string;
  price: number;
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
}

export interface IAddress {
  name: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface IOrder {
  userId: Types.ObjectId;
  orderNumber: string;
  items: IOrderItem[];
  shippingAddress: IAddress;
  billingAddress: IAddress;
  subtotal: number;
  tax: number;
  shippingCost: number;
  total: number;
  paymentMethod: "stripe" | "cod";
  paymentStatus: "pending" | "paid" | "failed";
  stripePaymentIntentId?: string;
  orderStatus: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  couponCode?: string;
  discountAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

type OrderModel = Model<IOrder>;

const orderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name:      { type: String, required: true },
    image:     { type: String, default: "" },
    price:     { type: Number, required: true },
    quantity:  { type: Number, required: true, min: 1 },
    selectedColor: { type: String },
    selectedSize:  { type: String },
  },
  { _id: false }
);

const addressSchema = new Schema<IAddress>(
  {
    name:    { type: String, required: true },
    street:  { type: String, required: true },
    city:    { type: String, required: true },
    state:   { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder, OrderModel>(
  {
    userId:      { type: Schema.Types.ObjectId, ref: "User", required: true },
    orderNumber: { type: String, required: true, unique: true },
    items:       { type: [orderItemSchema], required: true },
    shippingAddress: { type: addressSchema, required: true },
    billingAddress:  { type: addressSchema, required: true },
    subtotal:     { type: Number, required: true },
    tax:          { type: Number, required: true },
    shippingCost: { type: Number, required: true },
    total:        { type: Number, required: true },
    paymentMethod: {
      type: String,
      enum: ["stripe", "cod"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    stripePaymentIntentId: { type: String },
    orderStatus: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    couponCode:     { type: String },
    discountAmount: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false }
);

const Order = model<IOrder, OrderModel>("Order", orderSchema);
export default Order;