import { PrismaClient } from "@prisma/client";

// Prevents creating multiple Prisma instances during development hot-reload
const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
