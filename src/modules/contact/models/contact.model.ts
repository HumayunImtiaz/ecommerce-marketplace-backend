import { Schema, model, Document } from "mongoose";

export interface IContact extends Document {
  name: string;
  email: string;
  subject: string;
  message: string;
  category: string;
  orderNumber?: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const contactSchema = new Schema<IContact>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    category: { type: String, required: true, default: "general" },
    orderNumber: { type: String },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Contact = model<IContact>("Contact", contactSchema);
export default Contact;
