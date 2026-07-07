import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../prisma/client.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

// POST /api/payments/initialize — body: { orderId }
// Starts a Paystack transaction and returns the checkout URL
router.post("/initialize", requireAuth, async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const order = await prisma.order.findFirst({ where: { id: orderId, userId: req.userId } });
    if (!order) return res.status(404).json({ error: "Order not found." });

    const user = await prisma.user.findUnique({ where: { id: req.userId } });

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        amount: order.total * 100, // Paystack expects kobo (naira × 100)
        reference: order.orderNumber,
        callback_url: `${process.env.FRONTEND_URL}/order-success`,
        metadata: { orderId: order.id },
      }),
    });

    const data = await response.json();
    if (!data.status) return res.status(400).json({ error: data.message || "Could not initialize payment." });

    res.json({ authorizationUrl: data.data.authorization_url, reference: data.data.reference });
  } catch (err) {
    next(err);
  }
});

// GET /api/payments/verify/:reference — confirm payment was successful
router.get("/verify/:reference", requireAuth, async (req, res, next) => {
  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${req.params.reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    });
    const data = await response.json();

    if (data.data?.status === "success") {
      const order = await prisma.order.update({
        where: { orderNumber: req.params.reference },
        data: { paymentStatus: "PAID", paymentRef: req.params.reference },
      });
      return res.json({ success: true, order });
    }

    res.json({ success: false, message: "Payment was not successful." });
  } catch (err) {
    next(err);
  }
});

// POST /api/payments/webhook — Paystack calls this automatically after payment
// IMPORTANT: this route must receive the RAW request body to verify the signature
router.post("/webhook", async (req, res, next) => {
  try {
    const signature = req.headers["x-paystack-signature"];
    const hash = crypto.createHmac("sha512", PAYSTACK_SECRET).update(req.rawBody).digest("hex");

    if (hash !== signature) {
      return res.status(401).json({ error: "Invalid webhook signature." });
    }

    const event = req.body;
    if (event.event === "charge.success") {
      await prisma.order.updateMany({
        where: { orderNumber: event.data.reference },
        data: { paymentStatus: "PAID", paymentRef: event.data.reference },
      });
    }

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
});

export default router;
