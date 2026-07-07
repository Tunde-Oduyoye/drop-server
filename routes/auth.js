import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma/client.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,                                    // JS can't read it — protects against XSS
  secure: process.env.NODE_ENV === "production",      // HTTPS only in production
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,                    // 7 days
};

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function signPasswordResetToken(user) {
  return jwt.sign(
    {
      purpose: "password-reset",
      userId: user.id,
      passwordHash: user.password,
    },
    process.env.JWT_SECRET,
    { expiresIn: "30m" }
  );
}

function publicUser(user) {
  const { password, ...rest } = user;
  return rest;
}

function storefrontUrl() {
  return (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
}

// POST /api/auth/register
router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are all required." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword },
    });

    const token = signToken(user.id);
    res.cookie("drop_token", token, COOKIE_OPTIONS);
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = signToken(user.id);
    res.cookie("drop_token", token, COOKIE_OPTIONS);
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  res.clearCookie("drop_token", COOKIE_OPTIONS);
  res.json({ message: "Logged out successfully." });
});

// POST /api/auth/forgot-password
router.post("/forgot-password", async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const message = "If an account exists for that email, a password reset link has been sent.";
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.json({ message });
    }

    const token = signPasswordResetToken(user);
    const resetUrl = `${storefrontUrl()}/reset-password/${token}`;

    // Local/dev fallback. In production, send resetUrl through your email provider.
    console.log(`Password reset link for ${user.email}: ${resetUrl}`);

    const payload = { message };
    if (process.env.NODE_ENV !== "production") {
      payload.resetUrl = resetUrl;
    }

    res.json(payload);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: "Reset token and new password are required." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters." });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ error: "This reset link is invalid or has expired." });
    }

    if (decoded.purpose !== "password-reset" || !decoded.userId || !decoded.passwordHash) {
      return res.status(400).json({ error: "This reset link is invalid or has expired." });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || user.password !== decoded.passwordHash) {
      return res.status(400).json({ error: "This reset link is invalid or has expired." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    res.clearCookie("drop_token", COOKIE_OPTIONS);
    res.json({ message: "Password reset successfully." });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me — check if logged in, get current user
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/auth/profile — update name, email, phone
router.patch("/profile", requireAuth, async (req, res, next) => {
  try {
    const { name, email, phone } = req.body;
    if (!name || !email) return res.status(400).json({ error: "Name and email are required." });

    // Check email not taken by another user
    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== req.userId) {
        return res.status(409).json({ error: "That email is already in use." });
      }
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { name, email, phone: phone || null },
    });
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/auth/password — change password
router.patch("/password", requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new passwords are required." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters." });
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ error: "Current password is incorrect." });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.userId }, data: { password: hashedPassword } });

    res.json({ message: "Password changed successfully." });
  } catch (err) {
    next(err);
  }
});

export default router;
