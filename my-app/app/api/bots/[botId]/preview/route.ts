import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { strategySpec, evaluateRule, describeStrategy } from "@/lib/workflow/strategy";
import { resolveActiveMarket } from "@/lib/workflow/active-market";
import { fetchCandles, CandleError } from "@/lib/workflow/candles";
import { MarketError } from "@/lib/polymarket-markets";
import { simulateBuy } from "@/lib/paper-fill";
import { z } from "zod";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

/**
 * Dry run for the strategy the user is editing: what this bot would do if it
 * fired right now. Nothing is saved and no order is placed.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bot = await prisma.bot.findFirst({ where: { id: (await params).botId, userId: session.user.id }, select: { id: true } });
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  const parsed = strategySpec.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the strategy settings." }, { status: 400, headers });
  }
  const spec = parsed.data;

  try {
    const [resolved, candles] = await Promise.all([
      resolveActiveMarket(spec),
      fetchCandles(spec, Math.max(spec.slowPeriod + 2, 50)),
    ]);
    const decision = evaluateRule(spec, candles);
    const base = {
      summary: describeStrategy(spec),
      marketSlug: resolved.slug,
      question: resolved.market.question,
      reason: decision.reason,
      lastClose: candles[candles.length - 1].close,
      checkedAt: new Date().toISOString(),
    };
    if (!decision.direction) return NextResponse.json({ ...base, wouldTrade: false }, { headers });

    const outcome = decision.direction === "UP" ? resolved.up : resolved.down;
    const res = await fetch(`https://clob.polymarket.com/book?${new URLSearchParams({ token_id: outcome.assetId })}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new MarketError("The order book is unavailable right now.", 502);
    const book = z.object({ min_order_size: z.coerce.number(), asks: z.array(z.object({ price: z.string(), size: z.string() })) }).safeParse(await res.json().catch(() => null));
    if (!book.success) throw new MarketError("The order book could not be read.", 502);

    let fill: { amount: number; shares: number; price: number } | null = null;
    let blocked: string | null = null;
    try {
      fill = simulateBuy(book.data.asks, spec.stakeUsd, spec.maxPrice);
      if (fill.shares + 1e-8 < book.data.min_order_size) {
        blocked = `This market's minimum order is ${book.data.min_order_size} shares; $${spec.stakeUsd} buys only ${fill.shares.toFixed(2)}.`;
        fill = null;
      }
    } catch {
      blocked = `Nothing is offered at or below ${spec.maxPrice} per share right now.`;
    }

    return NextResponse.json({
      ...base, wouldTrade: !blocked, direction: decision.direction, outcome: outcome.label,
      estimatedShares: fill?.shares ?? null, estimatedPrice: fill?.price ?? null, blocked,
    }, { headers });
  } catch (error) {
    const status = error instanceof MarketError ? error.status : error instanceof CandleError ? 503 : 502;
    const message = error instanceof MarketError || error instanceof CandleError ? error.message : "The preview could not be produced.";
    return NextResponse.json({ error: message }, { status, headers });
  }
}
