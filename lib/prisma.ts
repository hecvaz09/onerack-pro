import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaConnectionString: string | undefined;
  prismaSchemaRevision: string | undefined;
};

// A changed .env must replace the development pool, rather than retaining the
// client created before database setup through Fast Refresh.
const existing = globalForPrisma.prisma;
const schemaRevision = "external-connections-v6";
const canReuse = existing && globalForPrisma.prismaConnectionString === connectionString && globalForPrisma.prismaSchemaRevision === schemaRevision;
export const prisma = canReuse ? existing : new PrismaClient({
  adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 10000 }),
});

if (process.env.NODE_ENV !== "production") {
  if (existing && !canReuse) void existing.$disconnect().catch(() => {});
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaConnectionString = connectionString;
  globalForPrisma.prismaSchemaRevision = schemaRevision;
}
