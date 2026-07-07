import "dotenv/config";
import { prisma } from "./prisma/client.js";

await prisma.user.update({
  where: { email: "babatundeoduyoye53@gmail.com" },
  data: { isAdmin: true },
});

console.log("✅ Admin access granted!");
await prisma.$disconnect();