import mongoose, { Document, Schema } from "mongoose";

export interface INotification extends Document {
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  isRead: boolean;
  relatedId?: string; // e.g. orderId or contactId
  relatedModel?: "Order" | "Contact" | "Product" | "User";
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { 
      type: String, 
      enum: ["info", "success", "warning", "error"], 
      default: "info" 
    },
    isRead: { type: Boolean, default: false },
    relatedId: { type: String },
    relatedModel: { type: String, enum: ["Order", "Contact", "Product", "User"] },
  },
  { timestamps: true }
);

const Notification = mongoose.model<INotification>("Notification", notificationSchema);

export default Notification;
