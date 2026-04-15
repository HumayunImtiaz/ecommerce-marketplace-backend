import dotenv from "dotenv";
dotenv.config();

import http from "http";
import app from "./app";
import prisma from "./config/prisma";
import { setupSocketIO } from "./socket";

const PORT = process.env.PORT || 5000;

const startServer = async (): Promise<void> => {
  try {
    await prisma.$connect();
    console.log("Database connected successfully (Prisma/PostgreSQL)");

    const httpServer = http.createServer(app);
    
    // Setup Socket.IO
    setupSocketIO(httpServer);

    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
};

startServer();