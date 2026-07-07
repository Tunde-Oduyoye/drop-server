import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

// POST /api/upload — body: { data: base64string, filename: string }
// Uploads directly to Cloudinary and returns the secure URL
router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { data, filename } = req.body;
    if (!data) return res.status(400).json({ error: "No image data provided." });

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      return res.status(500).json({ error: "Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET to your .env file." });
    }

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file: data,
        upload_preset: uploadPreset,
        folder: "drop-store/products",
        public_id: filename ? filename.replace(/\.[^.]+$/, "") : undefined,
      }),
    });

    const result = await response.json();

    if (result.error) {
      return res.status(400).json({ error: result.error.message });
    }

    res.json({ url: result.secure_url, publicId: result.public_id });
  } catch (err) {
    next(err);
  }
});

export default router;
