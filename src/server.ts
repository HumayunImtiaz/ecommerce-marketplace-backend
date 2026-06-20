import dotenv from "dotenv";
dotenv.config();

import http from "http";
import app from "./app";
import prisma from "./config/prisma";
import { setupSocketIO } from "./socket";

const PORT = Number(process.env.PORT) || 7860;

const startServer = async (): Promise<void> => {
  try {
    await prisma.$connect();
    console.log("Database connected successfully (Prisma/PostgreSQL)");

    const httpServer = http.createServer(app);
    
    
    setupSocketIO(httpServer);

    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`Server is successfully running on port ${PORT}`);
      console.log(`Open your Space at: https://huggingface.co/spaces/${process.env.SPACE_ID || 'Humayun0987/luxacart-backend'}`);
    });
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
};

startServer();