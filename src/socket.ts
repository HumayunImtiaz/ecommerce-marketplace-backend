import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import prisma from "./config/prisma";

let ioInstance: SocketIOServer | null = null;

export function setupSocketIO(httpServer: HTTPServer) {
  const allowedOrigins = [
    process.env.CLIENT_URL,
    process.env.ADMIN_CLIENT_URL,
  ].filter(Boolean) as string[];

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  ioInstance = io;

  io.on("connection", (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join a specific chat room
    socket.on("join_room", (chatId: string) => {
      socket.join(chatId);
      console.log(`Socket ${socket.id} joined room ${chatId}`);
    });

    // Handle sending a message
    socket.on(
      "send_message",
      async (data: {
        chatId: string;
        senderId: string;
        senderModel: "User" | "Admin";
        content: string;
      }) => {
        try {
          // Save message to database via Prisma
          const newMessage = await prisma.message.create({
            data: {
              chatId: data.chatId,
              senderId: data.senderId,
              senderModel: data.senderModel,
              content: data.content,
              isRead: false,
            },
          });

          // Broadcast to the specific room
          io.to(data.chatId).emit("receive_message", newMessage);
          
          // Also broadcast to admin room so admins see notifications/list updates
          io.to("admin_room").emit("admin_receive_message", newMessage);
        } catch (error) {
          console.error("Error saving message:", error);
        }
      }
    );

    // Join admin room
    socket.on("join_admin", () => {
      socket.join("admin_room");
      console.log(`Socket ${socket.id} joined admin_room`);
    });

    // Handle marking message as read
    socket.on("mark_read", (data: { chatId: string, readerRole: "User" | "Admin" }) => {
      // Broadcast this so the sender knows their messages were read
      io.to(data.chatId).emit("messages_read", data);
      if (data.readerRole === "Admin") {
        // Also inform other admins that this chat might be read now
        io.to("admin_room").emit("admin_messages_read", data);
      }
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO() {
  return ioInstance;
}
