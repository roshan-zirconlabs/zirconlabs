import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    return new Proxy({} as PrismaClient, {
      get(_target, prop) {
        if (prop === "then") return undefined;
        throw new Error(
          "PrismaClient not available. Ensure DATABASE_URL is set in .env",
        );
      },
    });
  }

  try {
    const pool = globalForPrisma.pool ?? new Pool({ connectionString, max: 3, connectionTimeoutMillis: 10000, idleTimeoutMillis: 20000 });
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.pool = pool;
    }
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
  } catch (err) {
    console.error("Failed to initialize PrismaClient with PrismaPg adapter:", err);
    return new Proxy({} as PrismaClient, {
      get(_target, prop) {
        if (prop === "then") return undefined;
        throw new Error(
          "PrismaClient failed to initialize. Check your DATABASE_URL.",
        );
      },
    });
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
