import { Router } from "express";
import { prisma } from "../prisma/client.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth); // every wishlist route needs a logged-in user

// GET /api/wishlist
router.get("/", async (req, res, next) => {
  try {
    const items = await prisma.wishlistItem.findMany({
      where: { userId: req.userId },
      include: { product: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ items: items.map(i => i.product) });
  } catch (err) {
    next(err);
  }
});

// POST /api/wishlist — body: { productId }
router.post("/", async (req, res, next) => {
  try {
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ error: "productId is required." });

    const item = await prisma.wishlistItem.upsert({
      where: { userId_productId: { userId: req.userId, productId } },
      update: {},
      create: { userId: req.userId, productId },
    });
    res.status(201).json({ item });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/wishlist/:productId
router.delete("/:productId", async (req, res, next) => {
  try {
    await prisma.wishlistItem.delete({
      where: { userId_productId: { userId: req.userId, productId: req.params.productId } },
    });
    res.json({ message: "Removed from wishlist." });
  } catch (err) {
    next(err);
  }
});

export default router;
