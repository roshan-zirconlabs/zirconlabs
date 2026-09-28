import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, json, readJson, requireUserId, HttpError } from "@/lib/api";
import { num } from "@/lib/money";
import { resolveOutcome } from "@/lib/polymarket/markets";
import { getOrderBook } from "@/lib/polymarket/prices";
import { priceSchema } from "@/lib/automations/config";
import { placeOrder } from "@/lib/trading/execute";
import { heldShares } from "@/lib/trading/portfolio";
import { createAutomation } from "@/lib/automations/service";

export async function GET(req: Request) {
  try {
    const userId = await requireUserId();
    const mode = new URL(req.url).searchParams.get("mode");
    const orders = await prisma.order.findMany({
      where: { userId, ...(mode === "LIVE" || mode === "PAPER" ? { mode } : {}) },
      orderBy: { createdAt: "desc" }, take: 50,
    });
    return json({
      orders: orders.map((o) => ({
        id: o.id, mode: o.mode, side: o.side, status: o.status, marketSlug: o.marketSlug, question: o.question, outcome: o.outcome,
        requested: num(o.requested), limitPrice: num(o.limitPrice), filledShares: num(o.filledShares), filledUsd: num(o.filledUsd),
        feeUsd: num(o.feeUsd), reason: o.reason, error: o.error, automationId: o.automationId, txHashes: o.txHashes,
        createdAt: o.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return fail(error);
  }
}

const protect = z.object({
  takeProfit: priceSchema.optional(),
  stopLoss: priceSchema.optional(),
  trailingCents: z.number().int().min(1).max(50).optional(),
}).strict();

const body = z.object({
  /** A fresh UUID per click; a double-submit reuses it and trades once. */
  requestId: z.uuid(),
  mode: z.enum(["PAPER", "LIVE"]),
  marketSlug: z.string().trim().min(1).max(240),
  outcome: z.string().trim().min(1).max(120),
  side: z.enum(["BUY", "SELL"]),
  /** BUY: all-in dollars. */
  amountUsd: z.number().finite().min(1).max(10000).optional(),
  /** SELL: share of the position, 1–100. */
  sellPercent: z.number().int().min(1).max(100).optional(),
  /** BUY: max price. SELL: min price. Defaults to 2¢ worse than the book. */
  limitPrice: priceSchema.optional(),
  protect: protect.optional(),
}).strict();

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const parsed = body.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(parsed.error.issues[0]?.message ?? "Check the order details.");
    const input = parsed.data;
    const { market, outcome } = await resolveOutcome(input.marketSlug, input.outcome);

    let size: number;
    let limit = input.limitPrice;
    const book = await getOrderBook(outcome.tokenId);
    if (input.side === "BUY") {
      if (!input.amountUsd) throw new HttpError("Enter how much to spend.");
      size = input.amountUsd;
      const ask = book.asks[0]?.price;
      if (limit === undefined) {
        if (ask === undefined) throw new HttpError("Nobody is selling this outcome right now.", 409);
        limit = Math.min(0.99, ask + 0.02);
      }
    } else {
      const held = await heldShares(userId, input.mode, outcome.tokenId);
      if (held <= 1e-6) throw new HttpError("You don't hold this outcome.", 409);
      size = held * ((input.sellPercent ?? 100) / 100);
      const bid = book.bids[0]?.price;
      if (limit === undefined) {
        if (bid === undefined) throw new HttpError("Nobody is buying this outcome right now.", 409);
        limit = Math.max(0.01, bid - 0.02);
      }
    }

    const { order, duplicate } = await placeOrder({
      userId, mode: input.mode, side: input.side, market, outcome, size, limitPrice: limit,
      reason: input.side === "BUY" ? "Manual buy." : "Manual sell.", idempotencyKey: `manual:${userId}:${input.requestId}`,
    });

    let protection: { id: string } | null = null;
    let protectionError: string | null = null;
    const filled = order.status === "FILLED" || order.status === "PARTIAL";
    if (!duplicate && filled && input.side === "BUY" && input.protect && Object.values(input.protect).some((v) => v !== undefined)) {
      try {
        protection = (await createAutomation({ userId, mode: input.mode, kind: "EXIT", marketSlug: market.slug, outcome: outcome.label, config: input.protect })).automation;
      } catch (error) {
        protectionError = error instanceof Error ? error.message : "Protection couldn't be attached.";
      }
    }

    return json({
      order: {
        id: order.id, status: order.status, side: order.side, filledShares: num(order.filledShares), filledUsd: num(order.filledUsd),
        feeUsd: num(order.feeUsd), error: order.error,
      },
      duplicate, protectionId: protection?.id ?? null, protectionError,
    }, filled ? 200 : 409);
  } catch (error) {
    return fail(error);
  }
}
