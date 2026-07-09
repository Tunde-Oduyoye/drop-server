import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import wishlistRoutes from "./routes/wishlist.js";
import reviewRoutes from "./routes/reviews.js";
import orderRoutes from "./routes/orders.js";
import paymentRoutes from "./routes/payments.js";
import uploadRoutes from "./routes/upload.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

const app = express();
const PORT = process.env.PORT || 5000;

// Render (and most hosts) sit your app behind a reverse proxy, which adds
// an X-Forwarded-For header to every request. Without this line, Express
// doesn't know to trust that header, which makes express-rate-limit throw
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR on every request through authLimiter
// below — effectively breaking login/register/admin-login in production.
// "1" means: trust exactly one hop (Render's own proxy) — not an open-ended
// trust of arbitrary forwarded headers from anywhere.
app.set("trust proxy", 1);

// ── Security ──────────────────────────────────────────────
app.use(helmet());
// Allow both the customer storefront and the admin dashboard to talk to this API.
// In production, set these as real deployed URLs via env vars.
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  process.env.ADMIN_URL || "http://localhost:5174",
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  credentials: true,
}));

// Rate limit auth routes specifically — prevents brute-force login attempts
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: "Too many attempts. Try again in 15 minutes." } });
app.use("/api/auth", authLimiter);

// ── Body parsing ──────────────────────────────────────────
// Paystack webhook needs the RAW body to verify the signature, so we capture
// it before JSON parsing converts the body to an object.
app.use("/api/payments/webhook", express.raw({ type: "application/json" }), (req, res, next) => {
  req.rawBody = req.body;
  req.body = JSON.parse(req.body.toString());
  next();
});
app.use(express.json());
app.use(cookieParser());

// ── Routes ────────────────────────────────────────────────
app.get("/api/health", (req, res) => res.json({ status: "ok", message: "DRØP API is running 🚀" }));

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/upload", uploadRoutes);

// ── Error handling (must be last) ────────────────────────
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`✅ DRØP API running on http://localhost:${PORT}`);
});