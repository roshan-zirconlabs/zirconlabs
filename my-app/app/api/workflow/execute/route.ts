import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OrderSide, OrderType } from "@polymarket/client";
import { prisma } from "@/lib/prisma";
import { bearerBotId } from "@/lib/workflow/bot-token";
import { strategySpec, evaluateRule, directionFromAlert } from "@/lib/workflow/strategy";
import crypto from "crypto";
import { TIMEFRAME_DURATION } from "@/lib/market-data";
import { resolveActiveMarket } from "@/lib/workflow/active-market";
import { fetchCandles, CandleError } from "@/lib/workflow/candles";
import { MarketError } from "@/lib/polymarket-markets";
import { simulateBuy } from "@/lib/paper-fill";
import { liveExecutionConfigured } from "@/lib/polymarket/managed-account";
import { createManagedPolymarketClient } from "@/lib/polymarket/live-client";
import { readAccountReadiness } from "@/lib/polymarket/account-readiness";
import { tradingDepositWallet } from "@/lib/polymarket/account";
import { reserveOrder } from "@/lib/polymarket/reserve-order";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "no-store" };

/**
 * Rule-driven runs carry the signal step's decision and are re-checked against
 * it. Alert-driven runs carry only the alert's wording: Zircon resolves the
 * open market and derives the window's request id itself, so the caller cannot
 * choose which market or how often to trade.
 */
const body = z.union([
  z.object({
    source: z.literal("rule").optional(),
    direction: z.enum(["UP", "DOWN"]),
    marketSlug: z.string().trim().min(1).max(240),
    requestId: z.uuid(),
  }),
  z.object({
    source: z.literal("alert"),
    alertAction: z.string().trim().min(1).max(40),
  }),
]);

/** A stable UUID for one bot/market/window, so a repeated alert cannot double-spend. */
function windowRequestId(botId: string, slug: string, window: number): string {
  const h = crypto.createHash("sha256").update(`${botId}:${slug}:${window}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

async function readBook(assetId: string) {
  const res = await fetch(`https://clob.polymarket.com/book?${new URLSearchParams({ token_id: assetId })}`, {
    cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new MarketError("The order book is unavailable. No fill was recorded.", 502);
  const parsed = z.object({
    asset_id: z.string(),
    min_order_size: z.coerce.number().finite().positive(),
    asks: z.array(z.object({ price: z.string(), size: z.string() })),
  }).safeParse(await res.json().catch(() => null));
  if (!parsed.success || parsed.data.asset_id !== assetId) {
    throw new MarketError("The order book could not be verified for this outcome.", 502);
  }
  return parsed.data;
}

/**
 * Called by the bot's KeeperHub workflow to act on a signal.
 *
 * The decision is recomputed here rather than trusted from the request: the
 * caller may only execute the trade this bot's own strategy currently implies.
 */
export async function POST(req: NextRequest) {
  const botId = bearerBotId(req);
  if (!botId) return NextResponse.json({ error: "Invalid or missing bot callback token." }, { status: 401, headers });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "The execute step needs a direction, market slug and request id from the signal step." }, { status: 400, headers });
  }
  const input = parsed.data;

  const bot = await prisma.bot.findUnique({ where: { id: botId }, select: { id: true, userId: true, status: true, strategy: true } });
  if (!bot) return NextResponse.json({ error: "Unknown bot." }, { status: 404, headers });
  if (bot.status !== "ACTIVE") return NextResponse.json({ error: "This bot is not active in Zircon." }, { status: 409, headers });

  const spec = strategySpec.safeParse(bot.strategy);
  if (!spec.success) return NextResponse.json({ error: "This bot has no valid strategy configured." }, { status: 409, headers });

  // A bot only accepts the trigger source it was configured with, so an alert
  // cannot drive a scheduled bot or vice versa.
  if ((input.source === "alert") !== (spec.data.source === "webhook")) {
    return NextResponse.json({ error: "This bot is not configured for that trigger source." }, { status: 409, headers });
  }

  async function alreadyTraded(requestId: string) {
    return prisma.trade.findUnique({ where: { keeperhubExecutionId: requestId } });
  }

  // A rule-driven run reuses the signal step's id; an alert never supplies one,
  // so it is derived here and the caller cannot bypass the per-window guard.
  if (input.source !== "alert") {
    const seen = await alreadyTraded(input.requestId);
    if (seen) {
      return NextResponse.json({ ok: true, duplicate: true, tradeId: seen.id, status: seen.status, message: "This window was already executed." }, { headers });
    }
  }

  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const resolved = await resolveActiveMarket(spec.data, nowSec);

    let direction: "UP" | "DOWN";
    let reason: string;
    let requestId: string;

    if (input.source === "alert") {
      const named = directionFromAlert(input.alertAction);
      if (!named) {
        return NextResponse.json({ error: `The alert said "${input.alertAction}", which does not name a direction. Send buy/sell, long/short or up/down.` }, { status: 400, headers });
      }
      direction = named;
      reason = `Alert said "${input.alertAction}".`;
      requestId = windowRequestId(bot.id, resolved.slug, Math.floor(nowSec / TIMEFRAME_DURATION[spec.data.timeframe]));
      const seen = await alreadyTraded(requestId);
      if (seen) {
        return NextResponse.json({ ok: true, duplicate: true, tradeId: seen.id, status: seen.status, message: "This market window was already traded. Repeat alerts in the same window are ignored." }, { headers });
      }
    } else {
      if (resolved.slug !== input.marketSlug) {
        return NextResponse.json({ error: "The market rotated between the signal and the order. Nothing was executed." }, { status: 409, headers });
      }
      const candles = await fetchCandles(spec.data, Math.max(spec.data.slowPeriod + 2, 50));
      const decision = evaluateRule(spec.data, candles);
      if (decision.direction !== input.direction) {
        return NextResponse.json({ error: "The strategy no longer implies that direction. Nothing was executed.", reason: decision.reason }, { status: 409, headers });
      }
      direction = input.direction;
      reason = decision.reason;
      requestId = input.requestId;
    }

    const outcome = direction === "UP" ? resolved.up : resolved.down;
    const book = await readBook(outcome.assetId);

    if (spec.data.mode === "paper") {
      let fill;
      try { fill = simulateBuy(book.asks, spec.data.stakeUsd, spec.data.maxPrice); }
      catch { return NextResponse.json({ error: `No shares are offered at or below ${spec.data.maxPrice} right now. Nothing was recorded.` }, { status: 409, headers }); }
      // A paper fill that Polymarket would have rejected is not a useful record.
      if (fill.shares + 1e-8 < book.min_order_size) {
        return NextResponse.json({
          error: `This market's minimum order is ${book.min_order_size} shares; a $${spec.data.stakeUsd} stake buys only ${fill.shares.toFixed(2)}. Nothing was recorded.`,
        }, { status: 409, headers });
      }
      const trade = await prisma.trade.create({ data: {
        userId: bot.userId, botId: bot.id, signal: "BUY", side: "BUY", direction,
        marketSlug: resolved.slug, tokenId: outcome.assetId, ...fill,
        status: "FILLED", executedAt: new Date(), paper: true, keeperhubExecutionId: requestId,
      } });
      return NextResponse.json({
        ok: true, paper: true, tradeId: trade.id, marketSlug: resolved.slug, direction,
        ...fill, reason,
        message: "Quote-time paper fill. Excludes fees, queue position and settlement. No real order was placed.",
      }, { headers });
    }

    // ── Live ────────────────────────────────────────────────────────────────
    if (!liveExecutionConfigured()) {
      return NextResponse.json({ error: "Live trading is not enabled on this deployment." }, { status: 503, headers });
    }
    const account = await prisma.polymarketManagedAccount.findUnique({ where: { userId: bot.userId } });
    if (!account || account.status !== "ACTIVE" || !account.liveEnabled) {
      return NextResponse.json({ error: "The bot owner's trading account is not funded and enabled for live trading." }, { status: 409, headers });
    }
    const depositWallet = await tradingDepositWallet(account);
    const readiness = await readAccountReadiness(depositWallet);
    if (!readiness.approvals.isFullyApproved) {
      return NextResponse.json({ error: "The trading account still needs Polymarket approvals." }, { status: 409, headers });
    }
    if (Number(readiness.balance) < spec.data.stakeUsd) {
      return NextResponse.json({ error: "The trading balance is below the stake for this run." }, { status: 409, headers });
    }

    const orderRequest = { marketSlug: resolved.slug, outcome: outcome.label, amountUsd: spec.data.stakeUsd, maxPrice: spec.data.maxPrice, requestId, confirm: true as const };
    const reserved = await reserveOrder(bot.userId, orderRequest, outcome.assetId);
    if (!reserved.created) {
      return NextResponse.json({ ok: true, duplicate: true, status: reserved.attempt.status, message: "This window is already being executed." }, { status: 202, headers });
    }

    const client = await createManagedPolymarketClient(account.providerWalletId, account.walletAddress);
    const response = await client.placeMarketOrder({
      assetId: outcome.assetId, amount: spec.data.stakeUsd, maxPrice: spec.data.maxPrice,
      side: OrderSide.BUY, orderType: OrderType.FOK,
    });
    if (!response.ok) {
      await prisma.polymarketOrderAttempt.update({ where: { id: reserved.attempt.id }, data: { status: "REJECTED", receipt: { ok: false, code: response.code } } });
      return NextResponse.json({ error: "Polymarket rejected the order.", code: response.code }, { status: 409, headers });
    }

    const trade = await prisma.trade.create({ data: {
      userId: bot.userId, botId: bot.id, signal: "BUY", side: "BUY", direction,
      marketSlug: resolved.slug, tokenId: outcome.assetId, amount: spec.data.stakeUsd, price: spec.data.maxPrice,
      status: "PENDING", orderId: response.orderId, executedAt: new Date(), paper: false,
      keeperhubExecutionId: requestId,
    } });
    await prisma.polymarketOrderAttempt.update({
      where: { id: reserved.attempt.id },
      data: { status: "ACCEPTED", orderId: response.orderId, receipt: { ok: true, orderId: response.orderId, status: response.status, tradeIds: response.tradeIds } },
    });
    return NextResponse.json({
      ok: true, paper: false, tradeId: trade.id, orderId: response.orderId, status: response.status,
      marketSlug: resolved.slug, direction, reason,
    }, { headers });
  } catch (error) {
    const status = error instanceof MarketError ? error.status : error instanceof CandleError ? 503 : 502;
    const message = error instanceof MarketError || error instanceof CandleError
      ? error.message
      : "The order step failed. If a live order may have reached Polymarket it is recorded as unresolved; it was not retried.";
    return NextResponse.json({ error: message }, { status, headers });
  }
}
