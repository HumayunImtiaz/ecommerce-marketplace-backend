import "express-async-errors";
import express, { Application } from "express";
import cors from "cors";
import path from "path";
import routes from "./routes";
import { errorHandler, notFound } from "./middlewares/error.middleware";
import webhookRoutes from "./modules/order/routes/webhook.route";

const app: Application = express();

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.ADMIN_CLIENT_URL,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {

      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: ${origin} is not allowed`));
      }
    },
    credentials: true,
  })
);

app.use("/api/webhook/stripe", (req, res, next) => {
  console.log(`➡️ [${new Date().toISOString()}] Webhook Attempt: ${req.method} ${req.url}`);
  next();
}, express.raw({ type: "*/*" }), webhookRoutes);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));

app.use("/api/auth", routes);

app.use(notFound);
app.use(errorHandler);

export default app;
// restart backend