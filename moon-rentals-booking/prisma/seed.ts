import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { vehicles } from "../lib/vehicles";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding vehicles...");

  for (const v of vehicles) {
    await prisma.vehicle.upsert({
      where: { id: v.id },
      update: {
        groupId: v.groupId,
        slug: v.slug,
        vin: v.vin,
        year: v.year,
        make: v.make,
        model: v.model,
        category: v.category,
        color: v.color,
        seats: v.seats,
        transmission: v.transmission,
        pricePerDay: v.pricePerDay,
        image: v.image,
        description: v.description,
        isActive: v.isActive,
      },
      create: {
        id: v.id,
        groupId: v.groupId,
        slug: v.slug,
        vin: v.vin,
        year: v.year,
        make: v.make,
        model: v.model,
        category: v.category,
        color: v.color,
        seats: v.seats,
        transmission: v.transmission,
        pricePerDay: v.pricePerDay,
        image: v.image,
        description: v.description,
        isActive: v.isActive,
      },
    });
  }

  console.log("Seeding complete.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });