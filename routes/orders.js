import { Router } from "express";
import { prisma } from "../prisma/client.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

function generateOrderNumber() {
  return `DRP${Date.now()}`;
}

// POST /api/orders — body: { items: [{productId,size,color,qty}], deliveryAddress, phone, paymentMethod, promoCode }
router.post("/", async (req, res, next) => {
  try {
    const { items, deliveryAddress, phone, paymentMethod, promoCode } = req.body;

    if (!items?.length) return res.status(400).json({ error: "Cart is empty." });
    if (!deliveryAddress || !phone) return res.status(400).json({ error: "Delivery address and phone are required." });

    // Fetch real product data server-side — never trust prices sent from the client
    const productIds = items.map(i => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });

    let subtotal = 0;
    const orderItemsData = items.map(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product) throw Object.assign(new Error(`Product ${item.productId} not found.`), { status: 400 });
      if (product.stock < item.qty) throw Object.assign(new Error(`${product.name} is out of stock.`), { status: 400 });

      subtotal += product.price * item.qty;
      return {
        productId: product.id,
        name: product.name,
        price: product.price,
        size: item.size,
        color: item.color,
        qty: item.qty,
      };
    });

    const shipping = subtotal >= 30000 ? 0 : 2500;
    let discount = 0;
    if (promoCode?.toUpperCase() === "DRØP15" || promoCode?.toUpperCase() === "DROP15") {
      discount = Math.round(subtotal * 0.15);
    }
    const total = subtotal + shipping - discount;

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: req.userId,
        subtotal,
        shipping,
        discount,
        total,
        paymentMethod,
        deliveryAddress,
        phone,
        items: { create: orderItemsData },
      },
      include: { items: true },
    });

    // Decrement stock for each purchased item
    await Promise.all(
      orderItemsData.map(item =>
        prisma.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.qty } },
        })
      )
    );

    res.status(201).json({ order });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders — order history for logged-in user
router.get("/", async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.userId },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

// ── Admin-only routes — MUST be registered before GET /:id, ──
// otherwise Express matches "admin" as the :id param and these never run.

// GET /api/orders/admin/all — every order across all customers
router.get("/admin/all", requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = status ? { status } : {};
    const orders = await prisma.order.findMany({
      where,
      include: { items: true, user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/orders/admin/:id/status — body: { status }
router.patch("/admin/:id/status", requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(", ")}` });
    }
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
      include: { items: true },
    });
    res.json({ order });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/admin/stats — dashboard overview numbers
router.get("/admin/stats", requireAdmin, async (req, res, next) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totalOrders, todayOrders, totalRevenue, pendingOrders, lowStockProducts, totalProducts, totalUsers] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.order.aggregate({ where: { paymentStatus: "PAID" }, _sum: { total: true } }),
      prisma.order.count({ where: { status: "PROCESSING" } }),
      prisma.product.findMany({ where: { stock: { lte: 5 } }, select: { id: true, name: true, stock: true } }),
      prisma.product.count(),
      prisma.user.count(),
    ]);

    res.json({
      totalOrders,
      todayOrders,
      totalRevenue: totalRevenue._sum.total || 0,
      pendingOrders,
      lowStockProducts,
      totalProducts,
      totalUsers,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/:id — single order detail (kept LAST so it doesn't swallow /admin/* routes above)
router.get("/:id", async (req, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { items: true },
    });
    if (!order) return res.status(404).json({ error: "Order not found." });
    res.json({ order });
  } catch (err) {
    next(err);
  }
});

export default router;
