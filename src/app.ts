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

// Global JSON Interceptor to map `id` to `_id` for backward compatibility with frontend
const attachMongoIds = (obj: any, seen = new WeakSet()): any => {
  if (obj === null || typeof obj !== "object") return obj;
  if (obj instanceof Date) return obj;
  if (seen.has(obj)) return obj;
  
  seen.add(obj);

  if (Array.isArray(obj)) return obj.map((item) => attachMongoIds(item, seen));

  const newObj: any = { ...obj };
  if (newObj.id !== undefined && newObj._id === undefined) {
    newObj._id = newObj.id;
  }
  for (const key in newObj) {
    if (Object.prototype.hasOwnProperty.call(newObj, key)) {
      newObj[key] = attachMongoIds(newObj[key], seen);
    }
  }
  return newObj;
};

app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function (body) {
    try {
      const transformedBody = attachMongoIds(body);
      return originalJson.call(this, transformedBody);
    } catch (err) {
      console.error("Error in JSON interceptor:", err);
      return originalJson.call(this, body);
    }
  };
  next();
});

app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);

export default app;
// restart backend