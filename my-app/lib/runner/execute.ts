import { z } from "zod";
import { OrderSide, OrderType, type SecureClient } from "@polymarket/client";
import { prisma } from "@/lib/prisma";
import { evaluateRule, directionFromAlert } from "@/lib/workflow/strategy";
import { resolveActiveMarket } from "@/lib/workflow/active-market";
import { fetchFreshCandles, CandleError } from "@/lib/workflow/candles";
import { MarketError } from "@/lib/polymarket-markets";
import { CRYPTO_TAKER_FEE_RATE, simulateBuy } from "@/lib/paper-fill";
import { liveExecutionConfigured } from "@/lib/polymarket/managed-account";
import { createManagedPolymarketClient } from "@/lib/polymarket/live-client";
import { readAccountReadiness } from "@/lib/polymarket/account-readiness";
import { tradingDepositWallet } from "@/lib/polymarket/account";
import { reserveOrder } from "@/lib/polymarket/reserve-order";
import { assertOrderRegionAllowed, RegionBlockedError } from "@/lib/polymarket/geoblock";
import { parseStrategy, StrategyMissingError, windowIndex, windowRequestId } from "./decide";

/**
 * Rule-driven runs carry the decision step's direction and are re-checked
 * against it. Alert-driven runs carry only the alert's wording: PolyTrade
 * resolves the open market and derives the window's request id itself, so the
 * caller cannot choose which market or how often to trade.
 */
export const executeInput = z.union([
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
export type ExecuteInput = z.infer<typeof executeInput>;
export type ExecuteResult = { status: number; body: Record<string, unknown> };

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

const ok = (body: Record<string, unknown>, status = 200): ExecuteResult => ({ status, body });
const fail = (error: string, status: number, extra: Record<string, unknown> = {}): ExecuteResult => ({ status, body: { error, ...extra } });

/**
 * Acts on a signal for one bot. The decision is recomputed here rather than
 * trusted from the caller: a caller may only execute the trade this bot's own
 * strategy currently implies. Used by scheduled runs, alerts and manual runs.
 */
export async function executeTrade(botId: string, input: ExecuteInput, nowSec = Math.floor(Date.now() / 1000)): Promise<ExecuteResult> {
  const bot = await prisma.bot.findUnique({ where: { id: botId }, select: { id: true, userId: true, status: true, strategy: true } });
  if (!bot) return fail("Unknown bot.", 404);
  if (bot.status !== "ACTIVE") return fail("This bot is not active.", 409);

  let spec;
  try { spec = parseStrategy(bot.strategy); } catch (error) {
    if (error instanceof StrategyMissingError) return fail(error.message, 409);
    throw error;
  }

  // A bot only accepts the trigger source it was configured with, so an alert
  // cannot drive a scheduled bot or vice versa.
  if ((input.source === "alert") !== (spec.source === "webhook")) {
    return fail("This bot is not configured for that trigger source.", 409);
  }

  const alreadyTraded = (requestId: string) => prisma.trade.findUnique({ where: { requestId } });

  // A rule-driven run reuses the decision's id; an alert never supplies one,
  // so it is derived here and the caller cannot bypass the per-window guard.
  if (input.source !== "alert") {
    const seen = await alreadyTraded(input.requestId);
    if (seen) return ok({ ok: true, duplicate: true, tradeId: seen.id, status: seen.status, message: "This window was already executed." });
  }

  try {
    const resolved = await resolveActiveMarket(spec, nowSec);

    let direction: "UP" | "DOWN";
    let reason: string;
    let requestId: string;

    if (input.source === "alert") {
      const named = directionFromAlert(input.alertAction);
      if (!named) {
        // TradingView only fills {{strategy.order.action}} in strategy alerts;
        // an indicator alert sends the placeholder through untouched.
        if (input.alertAction.includes("{{")) {
          return fail('TradingView sent the placeholder unfilled. {{strategy.order.action}} only works in alerts on a strategy; for an indicator alert, write "buy" or "sell" in the message instead.', 400);
        }
        return fail(`The alert said "${input.alertAction}", which does not name a direction. Send buy/sell, long/short or up/down.`, 400);
      }
      direction = named;
      reason = `Alert said "${input.alertAction}".`;
      requestId = windowRequestId(bot.id, resolved.slug, windowIndex(spec, nowSec));
      const seen = await alreadyTraded(requestId);
      if (seen) {
        return ok({ ok: true, duplicate: true, tradeId: seen.id, status: seen.status, message: "This market window was already traded. Repeat alerts in the same window are ignored." });
      }
    } else {
      if (resolved.slug !== input.marketSlug) {
        return fail("The market rotated between the signal and the order. Nothing was executed.", 409);
      }
      const candles = await fetchFreshCandles(spec, Math.max(spec.slowPeriod + 2, 50), nowSec);
      const decision = evaluateRule(spec, candles);
      if (decision.direction !== input.direction) {
        return fail("The strategy no longer implies that direction. Nothing was executed.", 409, { reason: decision.reason });
      }
      direction = input.direction;
      reason = decision.reason;
      requestId = input.requestId;
    }

    const outcome = direction === "UP" ? resolved.up : resolved.down;
    const book = await readBook(outcome.assetId);

    if (spec.mode === "paper") {
      let fill;
      try { fill = simulateBuy(book.asks, spec.stakeUsd, spec.maxPrice, CRYPTO_TAKER_FEE_RATE); }
      catch { return fail(`No shares are offered at or below ${spec.maxPrice} right now. Nothing was recorded.`, 409); }
      // A paper fill that Polymarket would have rejected is not a useful record.
      if (fill.shares + 1e-8 < book.min_order_size) {
        return fail(`This market's minimum order is ${book.min_order_size} shares; a $${spec.stakeUsd} stake buys only ${fill.shares.toFixed(2)}. Nothing was recorded.`, 409);
      }
      const trade = await prisma.trade.create({ data: {
        userId: bot.userId, botId: bot.id, signal: "BUY", side: "BUY", direction,
        marketSlug: resolved.slug, tokenId: outcome.assetId, ...fill,
        status: "FILLED", executedAt: new Date(), paper: true, requestId,
      } });
      return ok({
        ok: true, paper: true, tradeId: trade.id, marketSlug: resolved.slug, direction,
        ...fill, reason,
        message: "Quote-time paper fill, net of Polymarket's taker fee. Excludes queue position and settlement. No real order was placed.",
      });
    }

    // ── Live ────────────────────────────────────────────────────────────────
    if (!liveExecutionConfigured()) return fail("Live trading is not enabled on this deployment.", 503);
    // Polymarket only lets new positions open from allowed regions. Checking
    // this server's own region first turns a silent rejection into a clear one.
    await assertOrderRegionAllowed();
    const account = await prisma.polymarketManagedAccount.findUnique({ where: { userId: bot.userId } });
    if (!account || account.status !== "ACTIVE" || !account.liveEnabled) {
      return fail("The bot owner's trading account is not funded and enabled for live trading.", 409);
    }
    const depositWallet = await tradingDepositWallet(account);
    const readiness = await readAccountReadiness(depositWallet);
    if (!readiness.approvals.isFullyApproved) return fail("The trading account still needs Polymarket approvals.", 409);
    if (Number(readiness.balance) < spec.stakeUsd) return fail("The trading balance is below the stake for this run.", 409);

    const orderRequest = { marketSlug: resolved.slug, outcome: outcome.label, amountUsd: spec.stakeUsd, maxPrice: spec.maxPrice, requestId, confirm: true as const };
    const reserved = await reserveOrder(bot.userId, orderRequest, outcome.assetId);
    if (!reserved.created) {
      return ok({ ok: true, duplicate: true, status: reserved.attempt.status, message: "This window is already being executed." }, 202);
    }

    let response: Awaited<ReturnType<SecureClient["placeMarketOrder"]>>;
    try {
      const client = await createManagedPolymarketClient(account.providerWalletId);
      response = await client.placeMarketOrder({
        assetId: outcome.assetId, amount: spec.stakeUsd, maxPrice: spec.maxPrice,
        side: OrderSide.BUY, orderType: OrderType.FOK,
      });
    } catch (error) {
      // The order may or may not have reached Polymarket: record that honestly
      // instead of leaving the reservation in SUBMITTING, and never retry.
      await prisma.polymarketOrderAttempt.update({ where: { id: reserved.attempt.id }, data: { status: "UNKNOWN", receipt: { ok: false, error: error instanceof Error ? error.message.slice(0, 240) : "unknown" } } }).catch(() => {});
      throw error;
    }
    if (!response.ok) {
      await prisma.polymarketOrderAttempt.update({ where: { id: reserved.attempt.id }, data: { status: "REJECTED", receipt: { ok: false, code: response.code } } });
      return fail("Polymarket rejected the order.", 409, { code: response.code });
    }

    // A buy spends collateral (making) for shares (taking). Record what actually
    // filled — not the stake and price cap — so P&L and the track record are real.
    const spent = Number(response.makingAmount);
    const shares = Number(response.takingAmount);
    const filled = response.status === "matched" && spent > 0 && shares > 0;
    // "delayed" means the market queues matching: it may still fill, so it is
    // recorded as pending rather than as a trade that did not happen.
    const queued = response.status === "delayed";
    const trade = await prisma.trade.create({ data: {
      userId: bot.userId, botId: bot.id, signal: "BUY", side: "BUY", direction,
      marketSlug: resolved.slug, tokenId: outcome.assetId,
      amount: filled ? spent : queued ? spec.stakeUsd : 0,
      shares: filled ? shares : queued ? null : 0,
      price: filled ? spent / shares : queued ? spec.maxPrice : 0,
      status: filled ? "FILLED" : queued ? "PENDING" : "CANCELLED", orderId: response.orderId, executedAt: new Date(), paper: false,
      requestId,
    } });
    await prisma.polymarketOrderAttempt.update({
      where: { id: reserved.attempt.id },
      data: { status: filled || queued ? "ACCEPTED" : "REJECTED", orderId: response.orderId, receipt: { ok: true, orderId: response.orderId, status: response.status, tradeIds: response.tradeIds, transactionsHashes: response.transactionsHashes } },
    });
    if (queued) {
      return ok({ ok: true, paper: false, queued: true, tradeId: trade.id, orderId: response.orderId, status: response.status, message: "Polymarket queued this order; it may still fill." }, 202);
    }
    if (!filled) return fail("The order was not filled at or below your price limit. Nothing was bought.", 409, { status: response.status });
    return ok({
      ok: true, paper: false, tradeId: trade.id, orderId: response.orderId, status: response.status,
      marketSlug: resolved.slug, direction, reason, amount: spent, shares, price: spent / shares,
    });
  } catch (error) {
    if (error instanceof RegionBlockedError) return fail(error.message, 503, { code: "REGION_BLOCKED" });
    const status = error instanceof MarketError ? error.status : error instanceof CandleError ? 503 : 502;
    const message = error instanceof MarketError || error instanceof CandleError
      ? error.message
      : "The order step failed. If a live order may have reached Polymarket it is recorded as unresolved; it was not retried.";
    return fail(message, status);
  }
}
