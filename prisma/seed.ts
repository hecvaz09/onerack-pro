import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type CatalogEntry = {
  manufacturer?: string | null;
  name?: string | null;
  model?: string | null;
  ru?: number | null;
  category?: string | null;
  [key: string]: unknown;
};

async function main() {
  const catalogPath = path.join(__dirname, "rr-catalog-v1.json");
  const catalog: Record<string, CatalogEntry> = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

  let count = 0;
  for (const [sku, device] of Object.entries(catalog)) {
    const data = {
      vendor: device.manufacturer || "Unknown",
      model: device.name || device.model || sku,
      // 0U devices (PDUs, twin nodes) are genuinely 0U — don't default them to 1.
      heightRU: device.ru ?? 0,
      category: device.category ?? null,
      rawData: device as Prisma.InputJsonValue,
    };

    await prisma.catalogDevice.upsert({
      where: { sku },
      create: { sku, ...data },
      update: data,
    });

    console.log(`Upserted ${sku} — ${data.model}`);
    count++;
  }

  console.log(`Seeded ${count} catalog devices.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
