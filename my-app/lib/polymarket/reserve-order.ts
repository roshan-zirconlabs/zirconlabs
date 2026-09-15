import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { assertBudget, assertSameRequest, type OrderInput } from "../polymarket-orders";
import { MarketError } from "../polymarket-markets";

export async function reserveOrder(userId: string, input: OrderInput, assetId: string) {
  // Serializes reservations for this user across serverless instances. No
  // network calls or signatures happen while holding the database lock.
  return prisma.$transaction(tx => reserveOrderInTransaction(tx, userId, input, assetId), { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 10000 });
}

export async function reserveOrderInTransaction(tx: Prisma.TransactionClient, userId: string, input: OrderInput, assetId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"polymarket-order:" + userId}))`;
    const existing = await tx.polymarketOrderAttempt.findUnique({ where: { userId_requestId: { userId, requestId: input.requestId } } });
    if (existing) { assertSameRequest(existing, input); return { attempt: existing, created: false }; }
    const account = await tx.polymarketManagedAccount.findUnique({ where: { userId } });
    if (!account || account.status !== "ACTIVE" || !account.liveEnabled) throw new MarketError("Enable your funded trading account before buying.", 409);
    const start = new Date(); start.setUTCHours(0, 0, 0, 0);
    const totals = await tx.polymarketOrderAttempt.aggregate({
      where: { userId, status: { not: "REJECTED" }, OR: [{ createdAt: { gte: start } }, { status: { in: ["SUBMITTING", "UNKNOWN"] } }] },
      _sum: { amountUsd: true },
    });
    assertBudget(account.dailyLimitUsd, Number(totals._sum.amountUsd ?? 0), input.amountUsd);
    const attempt = await tx.polymarketOrderAttempt.create({ data: { userId, requestId: input.requestId, marketSlug: input.marketSlug, outcome: input.outcome, assetId, amountUsd: input.amountUsd, maxPrice: input.maxPrice } });
    return { attempt, created: true };
}
