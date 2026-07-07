import { Router } from "express";
import { prisma } from "../prisma/client.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/reviews/:productId
router.get("/:productId", async (req, res, next) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { productId: req.params.productId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ reviews });
  } catch (err) {
    next(err);
  }
});

// POST /api/reviews/:productId — body: { rating, text }
router.post("/:productId", requireAuth, async (req, res, next) => {
  try {
    const { rating, text } = req.body;
    if (!rating || !text) return res.status(400).json({ error: "rating and text are required." });
    if (rating < 1 || rating > 5) return res.status(400).json({ error: "rating must be between 1 and 5." });

    // Check if user actually bought this product — sets the "verified" badge
    const hasPurchased = await prisma.orderItem.findFirst({
      where: { productId: req.params.productId, order: { userId: req.userId, paymentStatus: "PAID" } },
    });

    const review = await prisma.review.create({
      data: { productId: req.params.productId, userId: req.userId, rating, text, verified: !!hasPurchased },
    });

    // Recalculate product's average rating
    const agg = await prisma.review.aggregate({
      where: { productId: req.params.productId },
      _avg: { rating: true },
    });
    await prisma.product.update({
      where: { id: req.params.productId },
      data: { rating: agg._avg.rating || 0 },
    });

    res.status(201).json({ review });
  } catch (err) {
    next(err);
  }
});

export default router;
