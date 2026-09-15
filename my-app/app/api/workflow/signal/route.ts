import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { bearerBotId } from "@/lib/workflow/bot-token";
import { strategySpec, evaluateRule } from "@/lib/workflow/strategy";
import { resolveActiveMarket } from "@/lib/workflow/active-market";
import { fetchCandles, CandleError } from "@/lib/workflow/candles";
import { MarketError } from "@/lib/polymarket-markets";
import { TIMEFRAME_DURATION } from "@/lib/market-data";

export const runtime = "nodejs";

/** A stable UUID for one bot/market/window, so a repeated tick cannot double-spend. */
function deterministicRequestId(botId: string, slug: string, window: number): string {
  const h = crypto.createHash("sha256").update(`${botId}:${slug}:${window}`).digest("hex");
  // Shape the digest as a v4-style UUID; uniqueness comes from the digest.
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const headers = { "Cache-Control": "no-store" };

/**
 * Called by the bot's KeeperHub workflow. Resolves the market that is open now,
 * evaluates the strategy rule, and returns a decision.
 *
 * `trade: false` is a normal outcome, not an error: the workflow's Condition
 * node simply stops the run. Errors are reserved for cases where the decision
 * could not be made at all.
 */
export async function POST(req: NextRequest) {
  const botId = bearerBotId(req);
  if (!botId) return NextResponse.json({ error: "Invalid or missing bot callback token." }, { status: 401, headers });

  const bot = await prisma.bot.findUnique({ where: { id: botId }, select: { id: true, status: true, strategy: true } });
  if (!bot) return NextResponse.json({ error: "Unknown bot." }, { status: 404, headers });
  if (bot.status !== "ACTIVE") {
    return NextResponse.json({ trade: false, reason: "This bot is not active in Zircon." }, { headers });
  }

  const spec = strategySpec.safeParse(bot.strategy);
  if (!spec.success) {
    return NextResponse.json({ error: "This bot has no valid strategy configured." }, { status: 409, headers });
  }

  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const [resolved, candles] = await Promise.all([
      resolveActiveMarket(spec.data, nowSec),
      fetchCandles(spec.data, Math.max(spec.data.slowPeriod + 2, 50)),
    ]);

    const decision = evaluateRule(spec.data, candles);
    const window = Math.floor(nowSec / TIMEFRAME_DURATION[spec.data.timeframe]);
    // One order per bot per market window: a re-run of the same schedule tick
    // reuses this id and is rejected downstream instead of double-spending.
    const requestId = deterministicRequestId(bot.id, resolved.slug, window);

    if (!decision.direction) {
      return NextResponse.json({ trade: false, reason: decision.reason, marketSlug: resolved.slug }, { headers });
    }

    const outcome = decision.direction === "UP" ? resolved.up : resolved.down;
    return NextResponse.json({
      trade: true,
      direction: decision.direction,
      reason: decision.reason,
      marketSlug: resolved.slug,
      question: resolved.market.question,
      assetId: outcome.assetId,
      outcome: outcome.label,
      stakeUsd: spec.data.stakeUsd,
      maxPrice: spec.data.maxPrice,
      mode: spec.data.mode,
      requestId,
      evaluatedAt: new Date(nowSec * 1000).toISOString(),
    }, { headers });
  } catch (error) {
    const status = error instanceof MarketError ? error.status : error instanceof CandleError ? 503 : 502;
    const message = error instanceof MarketError || error instanceof CandleError
      ? error.message
      : "The signal could not be evaluated. No order was prepared.";
    return NextResponse.json({ error: message }, { status, headers });
  }
}
