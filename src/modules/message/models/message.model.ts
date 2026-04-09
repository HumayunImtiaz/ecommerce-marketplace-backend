import { Schema, model, Document } from "mongoose";

export interface IMessage extends Document {
  chatId: string; // The user ID represents the unique chat room between user and admin
  senderId: string; // The ID of the user or admin who sent the message
  senderModel: "User" | "Admin";
  content: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    chatId: { type: String, required: true, index: true },
    senderId: { type: String, required: true },
    senderModel: { type: String, enum: ["User", "Admin"], required: true },
    content: { type: String, required: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Message = model<IMessage>("Message", messageSchema);
export default Message;
