import "server-only";
import { Prisma, type Order, type TradingMode } from "@prisma/client";
import { OrderSide, OrderType } from "@polymarket/client";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { num, toTick, usd } from "@/lib/money";
import { simulateBuy, simulateSell, takerFee, FillError } from "@/lib/paper-fill";
import type { Market, Outcome } from "@/lib/polymarket/markets";
import { getOrderBook, getLivePositions } from "@/lib/polymarket/prices";
import { collateralBalance } from "@/lib/polymarket/account-readiness";
import { createManagedPolymarketClient } from "@/lib/polymarket/live-client";
import { liveTradingAvailable } from "@/lib/polymarket/managed-account";
import { tradingDepositWallet } from "@/lib/polymarket/account";

/**
 * The single path every order takes, manual or automated, practice or live.
 *
 * Order of operations is what keeps money safe:
 *   1. an Order row keyed by `idempotencyKey` is written before anything is
 *      sent — a retry finds that row instead of trading twice;
 *   2. practice fills are walked against the real order book with the
 *      market's real fee;
 *   3. live orders check the kill switch, daily limit and balance, then send
 *      one fill-and-kill order. A live order is never retried: if we can't tell
 *      whether it reached Polymarket, it is recorded UNKNOWN for review.
 */

export class OrderError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "OrderError";
  }
}

export type OrderIntent = {
  userId: string;
  mode: TradingMode;
  side: "BUY" | "SELL";
  market: Market;
  outcome: Outcome;
  /** BUY: all-in USD to spend. SELL: shares to sell. */
  size: number;
  /** BUY: highest price per share. SELL: lowest price per share. */
  limitPrice: number;
  reason: string;
  idempotencyKey: string;
  automationId?: string | null;
};

export type OrderResult = { order: Order; duplicate: boolean };

const MIN_BUY_USD = 1;

function startOfUtcDay(now = new Date()) {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function reserve(intent: OrderIntent, limitPrice: number, extra?: (tx: Prisma.TransactionClient) => Promise<void>) {
  return prisma.$transaction(async (tx) => {
    // Serializes a user's orders across processes so the limit checks below
    // can't be raced. No network calls happen while this is held.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"orders:" + intent.userId}))`;
    const existing = await tx.order.findUnique({ where: { idempotencyKey: intent.idempotencyKey } });
    if (existing) return { order: existing, duplicate: true };
    await extra?.(tx);
    const order = await tx.order.create({
      data: {
        userId: intent.userId, automationId: intent.automationId ?? null, mode: intent.mode, side: intent.side,
        tokenId: intent.outcome.tokenId, conditionId: intent.market.conditionId, marketSlug: intent.market.slug,
        question: intent.market.question, outcome: intent.outcome.label, requested: intent.size, limitPrice,
        reason: intent.reason.slice(0, 500), idempotencyKey: intent.idempotencyKey,
      },
    });
    return { order, duplicate: false };
  }, { timeout: 15000 });
}

function describe(order: Order) {
  const shares = num(order.filledShares);
  const verb = order.side === "BUY" ? "Bought" : "Sold";
  return `${verb} ${shares.toFixed(2)} ${order.outcome} shares at ${(num(order.filledUsd) / Math.max(shares, 1e-9) * 100).toFixed(1)}¢ avg — ${order.question}`;
}

async function finish(order: Order, data: Prisma.OrderUpdateInput, level: "SUCCESS" | "WARNING" | "ERROR", title?: string) {
  const updated = await prisma.order.update({ where: { id: order.id }, data });
  const practice = updated.mode === "PAPER" ? " (practice)" : "";
  await logActivity({
    userId: updated.userId, orderId: updated.id, automationId: updated.automationId, mode: updated.mode, level,
    title: (title ?? (updated.status === "FILLED" || updated.status === "PARTIAL" ? describe(updated) : `Order not filled — ${updated.question}`)) + practice,
    detail: [updated.reason, updated.error].filter(Boolean).join(" "),
  });
  return updated;
}

export async function placeOrder(intent: OrderIntent): Promise<OrderResult> {
  const { market, side, size } = intent;
  if (!market.tradable) throw new OrderError("This market isn't accepting orders right now.", 409);
  if (!(size > 0)) throw new OrderError("Enter an amount greater than zero.");
  if (side === "BUY" && size < MIN_BUY_USD) throw new OrderError(`The smallest buy is $${MIN_BUY_USD}.`);
  const limitPrice = toTick(intent.limitPrice, market.tickSize, side === "BUY" ? "down" : "up");
  return intent.mode === "PAPER" ? placePaper(intent, limitPrice) : placeLive(intent, limitPrice);
}

// ── Practice ────────────────────────────────────────────────────────────────

async function placePaper(intent: OrderIntent, limitPrice: number): Promise<OrderResult> {
  const reserved = await reserve(intent, limitPrice);
  if (reserved.duplicate) return reserved;
  const { order } = reserved;

  try {
    const book = await getOrderBook(intent.outcome.tokenId);
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"paper:" + intent.userId}))`;
      const user = await tx.user.findUniqueOrThrow({ where: { id: intent.userId }, select: { paperCash: true } });
      const held = await tx.paperPosition.findUnique({ where: { userId_tokenId: { userId: intent.userId, tokenId: intent.outcome.tokenId } } });

      if (intent.side === "BUY") {
        const budget = Math.min(intent.size, num(user.paperCash));
        if (budget < MIN_BUY_USD) throw new OrderError("Not enough practice cash for this buy.", 409);
        const fill = simulateBuy(book.asks, budget, limitPrice, intent.market.fee);
        await tx.user.update({ where: { id: intent.userId }, data: { paperCash: { decrement: fill.usd } } });
        await tx.paperPosition.upsert({
          where: { userId_tokenId: { userId: intent.userId, tokenId: intent.outcome.tokenId } },
          create: {
            userId: intent.userId, tokenId: intent.outcome.tokenId, conditionId: intent.market.conditionId,
            marketSlug: intent.market.slug, question: intent.market.question, outcome: intent.outcome.label,
            shares: fill.shares, costUsd: fill.usd, endDate: intent.market.endDate ? new Date(intent.market.endDate) : null,
          },
          update: { shares: { increment: fill.shares }, costUsd: { increment: fill.usd }, settledAt: null },
        });
        return { fill, target: intent.size, amountDone: fill.usd };
      }

      const heldShares = num(held?.shares);
      if (!held || heldShares <= 1e-6) throw new OrderError("You don't hold this outcome in practice mode.", 409);
      const target = Math.min(intent.size, heldShares);
      const fill = simulateSell(book.bids, target, limitPrice, intent.market.fee);
      const remaining = heldShares - fill.shares;
      const costLeft = remaining > 1e-6 ? num(held.costUsd) * (remaining / heldShares) : 0;
      await tx.user.update({ where: { id: intent.userId }, data: { paperCash: { increment: fill.usd } } });
      await tx.paperPosition.update({ where: { id: held.id }, data: { shares: Math.max(0, remaining), costUsd: costLeft } });
      return { fill, target, amountDone: fill.shares };
    }, { timeout: 15000 });

    const { fill } = result;
    const complete = result.amountDone >= result.target * 0.99;
    const updated = await finish(order, {
      status: complete ? "FILLED" : "PARTIAL", filledShares: fill.shares, filledUsd: fill.usd, feeUsd: fill.feeUsd,
    }, "SUCCESS");
    return { order: updated, duplicate: false };
  } catch (error) {
    const message = error instanceof OrderError || error instanceof FillError ? error.message : "Practice order failed. Nothing was recorded.";
    const updated = await finish(order, { status: error instanceof FillError ? "UNFILLED" : "REJECTED", error: message }, "WARNING");
    return { order: updated, duplicate: false };
  }
}

// ── Live ────────────────────────────────────────────────────────────────────

async function placeLive(intent: OrderIntent, limitPrice: number): Promise<OrderResult> {
  if (!liveTradingAvailable()) throw new OrderError("Live trading isn't enabled on this deployment.", 503);
  const account = await prisma.tradingAccount.findUnique({ where: { userId: intent.userId } });
  if (!account) throw new OrderError("Create and fund your trading account before trading live.", 409);
  if (!account.liveEnabled) throw new OrderError("Turn on live trading in Account first.", 409);
  if (account.paused) throw new OrderError("Trading is paused (kill switch is on). Resume it in Account.", 409);

  const reserved = await reserve(intent, limitPrice, async (tx) => {
    if (intent.side !== "BUY") return;
    const since = new Date(Date.now() - 24 * 3_600_000);
    const today = await tx.order.findMany({
      where: {
        userId: intent.userId, mode: "LIVE", side: "BUY",
        OR: [
          { createdAt: { gte: startOfUtcDay() }, status: { in: ["FILLED", "PARTIAL", "QUEUED", "SUBMITTING", "UNKNOWN"] } },
          // An order we can't confirm still counts for a full day.
          { createdAt: { gte: since }, status: { in: ["SUBMITTING", "UNKNOWN", "QUEUED"] } },
        ],
      },
      select: { id: true, status: true, requested: true, filledUsd: true },
    });
    const used = new Map(today.map((o) => [o.id, o.status === "FILLED" || o.status === "PARTIAL" ? num(o.filledUsd) : num(o.requested)]));
    const spent = [...used.values()].reduce((a, b) => a + b, 0);
    const limit = num(account.dailyLimitUsd);
    if (spent + intent.size > limit + 1e-9) {
      throw new OrderError(`This buy would pass your daily live limit (${usd(spent)} of ${usd(limit)} used today).`, 409);
    }
  });
  if (reserved.duplicate) return reserved;
  const { order } = reserved;

  let depositWallet: string;
  let shares = intent.size;
  try {
    depositWallet = await tradingDepositWallet(account);
    if (intent.side === "BUY") {
      const balance = await collateralBalance(depositWallet);
      if (balance.usd < intent.size) {
        const updated = await finish(order, { status: "REJECTED", error: `Not enough balance: ${usd(balance.usd)} available.` }, "WARNING");
        return { order: updated, duplicate: false };
      }
    } else {
      const held = (await getLivePositions(depositWallet)).find((p) => p.tokenId === intent.outcome.tokenId);
      if (!held || held.shares <= 1e-6) {
        const updated = await finish(order, { status: "REJECTED", error: "This wallet no longer holds that outcome." }, "WARNING");
        return { order: updated, duplicate: false };
      }
      shares = Math.min(intent.size, held.shares);
    }
  } catch {
    const updated = await finish(order, { status: "REJECTED", error: "Couldn't read your trading wallet. Nothing was sent." }, "ERROR");
    return { order: updated, duplicate: false };
  }

  let response: Awaited<ReturnType<Awaited<ReturnType<typeof createManagedPolymarketClient>>["placeMarketOrder"]>>;
  try {
    const client = await createManagedPolymarketClient(account.providerWalletId);
    response = await client.placeMarketOrder(intent.side === "BUY"
      ? { assetId: intent.outcome.tokenId, side: OrderSide.BUY, amount: intent.size, maxSpend: intent.size, maxPrice: limitPrice, orderType: OrderType.FAK }
      : { assetId: intent.outcome.tokenId, side: OrderSide.SELL, shares, minPrice: limitPrice, orderType: OrderType.FAK });
  } catch (error) {
    // It may or may not have reached Polymarket. Never retry; surface it.
    const updated = await finish(order, {
      status: "UNKNOWN", error: `Couldn't confirm the order reached Polymarket (${error instanceof Error ? error.message.slice(0, 160) : "unknown error"}). It was not retried — check your positions before placing it again.`,
    }, "ERROR", `Order outcome unknown — ${intent.market.question}`);
    return { order: updated, duplicate: false };
  }

  if (!response.ok) {
    const updated = await finish(order, { status: "REJECTED", error: `Polymarket rejected the order (${response.code}).` }, "WARNING");
    return { order: updated, duplicate: false };
  }
  if (response.status === "delayed") {
    const updated = await finish(order, { status: "QUEUED", exchangeOrderId: response.orderId, txHashes: response.transactionsHashes }, "SUCCESS",
      `Order queued by Polymarket — ${intent.market.question}`);
    return { order: updated, duplicate: false };
  }

  // A buy gives collateral (making) for shares (taking); a sell the reverse.
  const making = Number(response.makingAmount);
  const taking = Number(response.takingAmount);
  const filledShares = intent.side === "BUY" ? taking : making;
  const filledUsd = intent.side === "BUY" ? making : taking;
  if (response.status !== "matched" || !(filledShares > 0)) {
    const updated = await finish(order, { status: "UNFILLED", exchangeOrderId: response.orderId, error: "Nothing was available within your price limit." }, "WARNING");
    return { order: updated, duplicate: false };
  }
  const target = intent.side === "BUY" ? intent.size : shares;
  const complete = (intent.side === "BUY" ? filledUsd : filledShares) >= target * 0.99;
  const updated = await finish(order, {
    status: complete ? "FILLED" : "PARTIAL", exchangeOrderId: response.orderId, txHashes: response.transactionsHashes,
    filledShares, filledUsd, feeUsd: takerFee(filledShares, filledUsd / filledShares, intent.market.fee),
  }, "SUCCESS");
  return { order: updated, duplicate: false };
}
