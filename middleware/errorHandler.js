export function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  const message = err.message || "";

  // Prisma cannot reach the database (Supabase paused, offline, bad URL, etc.)
  if (err.code === "P1001" || err.code === "P1002" || message.includes("Can't reach database server")) {
    return res.status(503).json({ error: "Database temporarily unavailable. Please try again in a moment." });
  }

  // Prisma authentication failed. Keep credentials/hosts out of client responses.
  if (err.code === "P1000") {
    return res.status(503).json({ error: "Database connection failed. Please check the server configuration." });
  }

  // Prisma unique constraint violation (e.g. duplicate email)
  if (err.code === "P2002") {
    return res.status(409).json({ error: `An account with this ${err.meta?.target?.[0] || "field"} already exists.` });
  }

  // Prisma record not found
  if (err.code === "P2025") {
    return res.status(404).json({ error: "The requested item was not found." });
  }

  // Default. Avoid leaking internal database/ORM messages to the storefront.
  const isPrismaError = err.name?.startsWith("Prisma") || err.clientVersion;
  res.status(err.status || 500).json({
    error: isPrismaError ? "Something went wrong. Please try again." : (message || "Something went wrong. Please try again."),
  });
}

export function notFound(req, res) {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
}
