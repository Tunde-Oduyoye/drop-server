import jwt from "jsonwebtoken";
import { prisma } from "../prisma/client.js";

// Protects routes — requires a valid logged-in user
export function requireAuth(req, res, next) {
  const token = req.cookies?.drop_token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated. Please sign in." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Session expired. Please sign in again." });
  }
}

// Protects admin-only routes — requires login AND isAdmin = true
export async function requireAdmin(req, res, next) {
  const token = req.cookies?.drop_token;
  if (!token) {
    return res.status(401).json({ error: "Not authenticated. Please sign in." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: "Admin access required." });
    }

    req.userId = user.id;
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Session expired. Please sign in again." });
  }
}

// Optional auth — attaches userId if logged in, but doesn't block the request
export function optionalAuth(req, res, next) {
  const token = req.cookies?.drop_token;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.userId = decoded.userId;
    } catch (err) {
      // Invalid token — just continue as a guest
    }
  }
  next();
}
