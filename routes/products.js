import { Router } from "express";
import { prisma } from "../prisma/client.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

// GET /api/products — list with filters, sort, search
// Query params: category, size, minPrice, maxPrice, sort, search, page, limit
router.get("/", async (req, res, next) => {
  try {
    const { category, size, minPrice, maxPrice, sort, search, page = 1, limit = 24 } = req.query;

    const where = {};
    if (category) where.category = category;
    if (size) where.sizes = { has: size };
    if (search) where.name = { contains: search, mode: "insensitive" };
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = Number(minPrice);
      if (maxPrice) where.price.lte = Number(maxPrice);
    }

    const orderBy = {
      price_asc: { price: "asc" },
      price_desc: { price: "desc" },
      rating: { rating: "desc" },
      newest: { createdAt: "desc" },
    }[sort] || { createdAt: "desc" };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.product.count({ where }),
    ]);

    res.json({ products, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:idOrSlug — single product detail
router.get("/:idOrSlug", async (req, res, next) => {
  try {
    const { idOrSlug } = req.params;
    const product = await prisma.product.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: {
        reviews: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      },
    });

    if (!product) return res.status(404).json({ error: "Product not found." });
    res.json({ product });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:id/related — related products (same category)
router.get("/:id/related", async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ error: "Product not found." });

    const related = await prisma.product.findMany({
      where: { category: product.category, id: { not: product.id } },
      take: 4,
    });
    res.json({ products: related });
  } catch (err) {
    next(err);
  }
});

// ── Admin-only routes below ──

// POST /api/products — create product (admin)
router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { name, slug, description, category, price, oldPrice, badge, colors, sizes, stock, images } = req.body;
    if (!name || !slug || !category || !price) {
      return res.status(400).json({ error: "name, slug, category, and price are required." });
    }
    const product = await prisma.product.create({
      data: { name, slug, description, category, price, oldPrice, badge, colors, sizes, stock, images },
    });
    res.status(201).json({ product });
  } catch (err) {
    next(err);
  }
});

// PUT /api/products/:id — update product (admin)
router.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ product });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/products/:id — delete product (admin)
router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } });
    res.json({ message: "Product deleted." });
  } catch (err) {
    next(err);
  }
});

export default router;
