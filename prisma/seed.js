import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Same products as the frontend mock data, so what you see in the demo
// matches what's actually in the database once connected.
const products = [
  { name: "Void Oversized Tee", slug: "void-oversized-tee", category: "Tops", price: 12500, oldPrice: null, badge: "New", colors: ["#1a1a1a","#f5f5f5","#2d4a22"], sizes: ["S","M","L","XL"], stock: 8, images: [], description: "Ultra-soft 300gsm heavyweight cotton. Oversized drop-shoulder cut, ribbed crew neck. Preshrunk — keeps its shape after every wash." },
  { name: "Carbon Slim Jeans", slug: "carbon-slim-jeans", category: "Jeans", price: 28000, oldPrice: 35000, badge: "Sale", colors: ["#1a2744","#1a1a1a"], sizes: ["28","30","32","34","36"], stock: 15, images: [], description: "Slim-fit stretch denim with a slight taper. 2% elastane for all-day comfort. Double-stitched seams, 5-pocket design." },
  { name: "Shadow Cap", slug: "shadow-cap", category: "Caps", price: 9500, oldPrice: null, badge: "New", colors: ["#1a1a1a","#f5f5f5","#8B4513"], sizes: ["One Size"], stock: 22, images: [], description: "6-panel structured cap, 100% cotton twill. Embroidered DRØP logo on front. Adjustable snapback." },
  { name: "Stealth Runner", slug: "stealth-runner", category: "Shoes", price: 45000, oldPrice: 52000, badge: "Limited", colors: ["#1a1a1a","#ffffff"], sizes: ["40","41","42","43","44","45"], stock: 4, images: [], description: "Knit upper with responsive foam midsole. Breathable mesh lining. Rubber outsole with multi-directional grip." },
  { name: "Recon Hoodie", slug: "recon-hoodie", category: "Tops", price: 22000, oldPrice: null, badge: "New", colors: ["#2d2d2d","#1a2744","#2d4a22"], sizes: ["S","M","L","XL","XXL"], stock: 12, images: [], description: "French terry fleece, 380gsm. Double-lined hood, kangaroo pocket with internal zip." },
  { name: "Urban Belt Co.", slug: "urban-belt-co", category: "Belts", price: 8500, oldPrice: 11000, badge: "Sale", colors: ["#1a1a1a","#8B4513"], sizes: ["S","M","L"], stock: 19, images: [], description: "Full-grain leather, 35mm width. Brushed gunmetal buckle. 5 adjustment holes." },
  { name: "Phantom Watch", slug: "phantom-watch", category: "Watches", price: 68000, oldPrice: null, badge: "🔥 Hot", colors: ["#1a1a1a","#c0c0c0"], sizes: ["One Size"], stock: 6, images: [], description: "42mm stainless steel case. Sapphire crystal glass. Japanese Miyota movement. 50m water resistant." },
  { name: "Drip Cargo Pants", slug: "drip-cargo-pants", category: "Jeans", price: 32000, oldPrice: 38000, badge: "Sale", colors: ["#2d2d2d","#3d4a22"], sizes: ["28","30","32","34"], stock: 9, images: [], description: "Relaxed-fit cargo with 6 functional pockets. Ripstop fabric — lightweight and durable." },
  { name: "Nite Rider Tee", slug: "nite-rider-tee", category: "Tops", price: 11000, oldPrice: null, badge: "🔥 Hot", colors: ["#1a1a1a","#f5f5f5"], sizes: ["S","M","L","XL"], stock: 30, images: [], description: "Regular-fit graphic tee. Reactive dye print — won't crack or fade. 100% ring-spun cotton." },
  { name: "Air Classic Boxer", slug: "air-classic-boxer", category: "Boxers", price: 5500, oldPrice: null, badge: null, colors: ["#1a1a1a","#1a2744","#2d4a22"], sizes: ["S","M","L","XL"], stock: 50, images: [], description: "Modal-cotton blend. 4-way stretch waistband. Moisture-wicking, anti-odour." },
  { name: "Void Shorts", slug: "void-shorts", category: "Tops", price: 14000, oldPrice: null, badge: "New", colors: ["#1a1a1a","#2d4a22","#8B4513"], sizes: ["S","M","L","XL"], stock: 17, images: [], description: "Woven nylon shorts with 7-inch inseam. Side pockets, internal liner." },
  { name: "Ghost Leather Belt", slug: "ghost-leather-belt", category: "Belts", price: 12000, oldPrice: null, badge: null, colors: ["#1a1a1a"], sizes: ["S","M","L"], stock: 11, images: [], description: "Top-grain leather. 40mm square buckle plated in matte black." },
  { name: "Core Logo Cap", slug: "core-logo-cap", category: "Caps", price: 8000, oldPrice: 10000, badge: "Sale", colors: ["#1a2744","#2d4a22","#1a1a1a"], sizes: ["One Size"], stock: 25, images: [], description: "Unstructured 6-panel, washed cotton. Low-profile logo embroidery." },
  { name: "Recon Watch", slug: "recon-watch", category: "Watches", price: 45000, oldPrice: 55000, badge: "Sale", colors: ["#1a2744","#1a1a1a"], sizes: ["One Size"], stock: 7, images: [], description: "40mm brushed steel case. 3-hand movement. Silicone strap with quick-release pin." },
  { name: "Cloud Step Sneaker", slug: "cloud-step-sneaker", category: "Shoes", price: 38000, oldPrice: null, badge: "New", colors: ["#f5f5f5","#1a1a1a","#2d4a22"], sizes: ["40","41","42","43","44"], stock: 14, images: [], description: "Vulcanised rubber sole. Canvas upper with reinforced toe cap. EVA insole." },
  { name: "Essential Boxer 3-Pack", slug: "essential-boxer-3-pack", category: "Boxers", price: 14500, oldPrice: 18000, badge: "Sale", colors: ["#1a1a1a","#1a2744","#f5f5f5"], sizes: ["S","M","L","XL"], stock: 35, images: [], description: "Three-pack of our bestselling boxer. Same premium modal-cotton blend." },
];

async function main() {
  console.log("🌱 Seeding database...");

  for (const p of products) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: p,
      create: p,
    });
  }
  console.log(`✅ Seeded ${products.length} products.`);

  // Create a default admin account so you can log into the admin dashboard.
  // CHANGE THIS PASSWORD after your first login in production.
  const adminEmail = "admin@drop.ng";
  const adminPassword = "ChangeMe123!";
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { isAdmin: true },
    create: { name: "Store Admin", email: adminEmail, password: hashedPassword, isAdmin: true },
  });

  console.log(`✅ Admin account ready — email: ${adminEmail} / password: ${adminPassword}`);
  console.log(`⚠️  Change this password after your first login!`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
