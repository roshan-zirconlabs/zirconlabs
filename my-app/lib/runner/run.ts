import { prisma } from "@/lib/prisma";
import { CandleError } from "@/lib/workflow/candles";
import { MarketError } from "@/lib/polymarket-markets";
import { TIMEFRAME_DURATION } from "@/lib/market-data";
import type { StrategySpec } from "@/lib/workflow/strategy";
import { decide, parseStrategy, StrategyMissingError, windowIndex } from "./decide";
import { executeTrade, type ExecuteResult } from "./execute";

/**
 * The PolyTrade runner.
 *
 * Scheduled bots are evaluated once per market window by `runScheduledBots`,
 * which anything can call every minute (Supabase pg_cron, a cron service, or
 * `yarn worker`). Alert bots run when their webhook receives a TradingView
 * alert. Both go through the same decision and order code, so the per-window
 * duplicate guard and live-order checks are identical.
 */

export type RunSource = "schedule" | "alert" | "manual";
export type RunOutcome = "TRADED" | "SAT_OUT" | "FAILED" | "DUPLICATE";
export type RunRecord = { outcome: RunOutcome; reason: string; tradeId?: string | null };

/**
 * When a window becomes due, and how late it may still be evaluated. The
 * offsets match the hosted schedules: hourly and longer windows wait five
 * minutes for the candle that just closed. A window the runner missed by more
 * than the grace period is skipped rather than traded late.
 */
export function windowTiming(timeframe: StrategySpec["timeframe"]): { offsetSec: number; graceSec: number } {
  const duration = TIMEFRAME_DURATION[timeframe];
  const offsetSec = timeframe === "15m" ? 15 : 300;
  return { offsetSec, graceSec: Math.min(Math.floor(duration / 3), 30 * 60) };
}

export function isWindowDue(timeframe: StrategySpec["timeframe"], nowSec: number): boolean {
  const duration = TIMEFRAME_DURATION[timeframe];
  const start = Math.floor(nowSec / duration) * duration;
  const { offsetSec, graceSec } = windowTiming(timeframe);
  return nowSec >= start + offsetSec && nowSec <= start + offsetSec + graceSec;
}

function classify(result: ExecuteResult): RunRecord {
  const body = result.body as { ok?: boolean; duplicate?: boolean; error?: string; message?: string; reason?: string; tradeId?: string };
  if (body.duplicate) return { outcome: "DUPLICATE", reason: body.message ?? "Already executed for this window.", tradeId: body.tradeId ?? null };
  if (result.status < 300 && body.ok) return { outcome: "TRADED", reason: body.reason ?? body.message ?? "Order placed.", tradeId: body.tradeId ?? null };
  return { outcome: "FAILED", reason: body.error ?? `Order step failed (${result.status}).` };
}

async function record(botId: string, source: RunSource, startedAt: number, run: RunRecord, result?: ExecuteResult) {
  const body = (result?.body ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  await prisma.botRun.create({ data: {
    botId, source, outcome: run.outcome, reason: run.reason.slice(0, 500),
    marketSlug: typeof body.marketSlug === "string" ? body.marketSlug : null,
    direction: typeof body.direction === "string" ? body.direction : null,
    amount: num(body.amount), shares: num(body.shares), price: num(body.price),
    paper: typeof body.paper === "boolean" ? body.paper : null,
    tradeId: run.tradeId ?? null,
    durationMs: Date.now() - startedAt,
  } }).catch(() => { /* The run log must never turn a placed order into a failure. */ });
}

function failure(error: unknown): RunRecord {
  if (error instanceof StrategyMissingError || error instanceof MarketError || error instanceof CandleError) {
    return { outcome: "FAILED", reason: error.message };
  }
  return { outcome: "FAILED", reason: "The bot could not be evaluated. No order was placed." };
}

/** Evaluates a rule bot now and trades if its rule says so. */
export async function runRuleBot(botId: string, spec: StrategySpec, source: RunSource, nowSec = Math.floor(Date.now() / 1000)): Promise<RunRecord> {
  const startedAt = Date.now();
  try {
    const decision = await decide(botId, spec, nowSec);
    if (!decision.trade) {
      const run: RunRecord = { outcome: "SAT_OUT", reason: decision.reason };
      await record(botId, source, startedAt, run, { status: 200, body: { marketSlug: decision.marketSlug } });
      return run;
    }
    const result = await executeTrade(botId, { source: "rule", direction: decision.direction, marketSlug: decision.marketSlug, requestId: decision.requestId }, nowSec);
    const run = classify(result);
    await record(botId, source, startedAt, run, result);
    return run;
  } catch (error) {
    const run = failure(error);
    await record(botId, source, startedAt, run);
    return run;
  }
}

/** Acts on a TradingView (or any) alert for an alert-driven bot. */
export async function runAlert(botId: string, alertAction: string): Promise<{ run: RunRecord; result: ExecuteResult }> {
  const startedAt = Date.now();
  const result = await executeTrade(botId, { source: "alert", alertAction });
  const run = classify(result);
  await record(botId, "alert", startedAt, run, result);
  return { run, result };
}

/** Active bots. Bots without a strategy are skipped by the caller. */
export function activeBots() {
  return prisma.bot.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, strategy: true, lastEvaluatedWindow: true },
  });
}

/**
 * One runner tick. Each due window is claimed with a conditional update, so
 * overlapping ticks (two cron callers, a slow previous tick) evaluate it once.
 */
export async function runScheduledBots(nowSec = Math.floor(Date.now() / 1000)) {
  const bots = await activeBots();
  const summary = { checked: bots.length, due: 0, traded: 0, satOut: 0, failed: 0, duplicate: 0 };
  const due: Array<{ id: string; spec: StrategySpec }> = [];
  for (const bot of bots) {
    let spec: StrategySpec;
    try { spec = parseStrategy(bot.strategy); } catch { continue; }
    if (spec.source !== "schedule" || !isWindowDue(spec.timeframe, nowSec)) continue;
    const window = windowIndex(spec, nowSec);
    if (bot.lastEvaluatedWindow !== null && bot.lastEvaluatedWindow >= window) continue;
    const claimed = await prisma.bot.updateMany({
      where: { id: bot.id, status: "ACTIVE", OR: [{ lastEvaluatedWindow: null }, { lastEvaluatedWindow: { lt: window } }] },
      data: { lastEvaluatedWindow: window },
    });
    if (claimed.count === 1) due.push({ id: bot.id, spec });
  }
  summary.due = due.length;

  // A few at a time: each run makes several outbound requests.
  const CONCURRENCY = 4;
  for (let i = 0; i < due.length; i += CONCURRENCY) {
    const runs = await Promise.all(due.slice(i, i + CONCURRENCY).map(b => runRuleBot(b.id, b.spec, "schedule", nowSec)));
    for (const run of runs) {
      if (run.outcome === "TRADED") summary.traded++;
      else if (run.outcome === "SAT_OUT") summary.satOut++;
      else if (run.outcome === "DUPLICATE") summary.duplicate++;
      else summary.failed++;
    }
  }
  await prisma.runnerHeartbeat.upsert({
    where: { id: "runner" },
    create: { id: "runner", lastTickAt: new Date(), lastSummary: summary },
    update: { lastTickAt: new Date(), lastSummary: summary },
  }).catch(() => { /* a heartbeat failure must not fail the tick */ });
  return summary;
}
