import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { reserveOrderInTransaction } from "../lib/polymarket/reserve-order";

/** All test DDL and rows live in a distinct schema inside one rolled-back tx. */
async function main() {
  const schema = `zircon_check_${randomUUID().replaceAll("-", "")}`;
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 8000 }, { schema }) });
  const rollback = new Error("ROLLBACK_VERIFIED_TEST");
  try {
    await db.$transaction(async tx => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      await tx.$executeRawUnsafe('CREATE TABLE "User" ("id" TEXT PRIMARY KEY)');
      await tx.$executeRawUnsafe('CREATE TABLE "PolymarketManagedAccount" (LIKE public."PolymarketManagedAccount" INCLUDING ALL)');
      const migration = await readFile(new URL("../prisma/migrations/20260915000500_polymarket_order_attempt/migration.sql", import.meta.url), "utf8");
      for (const sql of migration.split(";").map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(sql);
      await tx.$executeRaw`INSERT INTO "User" ("id") VALUES ('test-reservation-user')`;
      await tx.polymarketManagedAccount.create({ data: { userId: "test-reservation-user", providerWalletId: "test-provider", walletAddress: "0x1111111111111111111111111111111111111111", liveEnabled: true, dailyLimitUsd: 10 } });
      const input = { marketSlug: "test-market", outcome: "Yes", amountUsd: 6, maxPrice: 0.5, confirm: true as const, requestId: randomUUID() };
      const first = await reserveOrderInTransaction(tx, "test-reservation-user", input, "123");
      assert.equal(first.created, true);
      const duplicate = await reserveOrderInTransaction(tx, "test-reservation-user", input, "123");
      assert.equal(duplicate.created, false);
      assert.equal(duplicate.attempt.id, first.attempt.id);
      await assert.rejects(() => reserveOrderInTransaction(tx, "test-reservation-user", { ...input, outcome: "No" }, "456"));
      await assert.rejects(() => reserveOrderInTransaction(tx, "test-reservation-user", { ...input, requestId: randomUUID() }, "123"));
      await tx.polymarketOrderAttempt.update({ where: { id: first.attempt.id }, data: { createdAt: new Date(0), status: "UNKNOWN" } });
      await assert.rejects(() => reserveOrderInTransaction(tx, "test-reservation-user", { ...input, requestId: randomUUID() }, "123"));
      await tx.polymarketOrderAttempt.update({ where: { id: first.attempt.id }, data: { status: "REJECTED" } });
      assert.equal((await reserveOrderInTransaction(tx, "test-reservation-user", { ...input, requestId: randomUUID() }, "123")).created, true);
      console.log("PASS: migration, request deduplication, conflicting retries, cumulative daily limit, unresolved prior-day reservations, rejected-order release.");
      throw rollback;
    }, { timeout: 30000 });
  } catch (e) { if (e !== rollback) throw e; }
  finally { await db.$disconnect(); }
  console.log("Verification transaction rolled back; no application data changed.");
}
main().catch(error => { console.error("Order reservation verification failed:", error instanceof Error ? error.name : "unknown"); process.exitCode = 1; });
