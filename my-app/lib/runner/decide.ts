import crypto from "crypto";
import { strategySpec, evaluateRule, type StrategySpec } from "@/lib/workflow/strategy";
import { resolveActiveMarket } from "@/lib/workflow/active-market";
import { fetchFreshCandles } from "@/lib/workflow/candles";
import { TIMEFRAME_DURATION } from "@/lib/market-data";

/** A stable UUID for one bot/market/window, so a repeated tick or alert cannot double-spend. */
export function windowRequestId(botId: string, slug: string, window: number): string {
  const h = crypto.createHash("sha256").update(`${botId}:${slug}:${window}`).digest("hex");
  // Shape the digest as a v4-style UUID; uniqueness comes from the digest.
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export function windowIndex(spec: Pick<StrategySpec, "timeframe">, nowSec: number): number {
  return Math.floor(nowSec / TIMEFRAME_DURATION[spec.timeframe]);
}

export type Decision =
  | { trade: false; reason: string; marketSlug?: string }
  | {
      trade: true;
      direction: "UP" | "DOWN";
      reason: string;
      marketSlug: string;
      question: string;
      assetId: string;
      outcome: string;
      stakeUsd: number;
      maxPrice: number;
      mode: StrategySpec["mode"];
      requestId: string;
      evaluatedAt: string;
    };

export class StrategyMissingError extends Error {
  constructor() { super("This bot has no valid strategy configured."); }
}

export function parseStrategy(value: unknown): StrategySpec {
  const spec = strategySpec.safeParse(value);
  if (!spec.success) throw new StrategyMissingError();
  return spec.data;
}

/**
 * Resolves the market that is open now and evaluates the bot's rule against
 * freshly closed candles. `trade: false` is a normal outcome, not an error.
 */
export async function decide(botId: string, spec: StrategySpec, nowSec = Math.floor(Date.now() / 1000)): Promise<Decision> {
  const [resolved, candles] = await Promise.all([
    resolveActiveMarket(spec, nowSec),
    fetchFreshCandles(spec, Math.max(spec.slowPeriod + 2, 50), nowSec),
  ]);
  const decision = evaluateRule(spec, candles);
  if (!decision.direction) return { trade: false, reason: decision.reason, marketSlug: resolved.slug };
  const outcome = decision.direction === "UP" ? resolved.up : resolved.down;
  return {
    trade: true,
    direction: decision.direction,
    reason: decision.reason,
    marketSlug: resolved.slug,
    question: resolved.market.question,
    assetId: outcome.assetId,
    outcome: outcome.label,
    stakeUsd: spec.stakeUsd,
    maxPrice: spec.maxPrice,
    mode: spec.mode,
    // One order per bot per market window: a re-run of the same tick reuses
    // this id and is rejected downstream instead of double-spending.
    requestId: windowRequestId(botId, resolved.slug, windowIndex(spec, nowSec)),
    evaluatedAt: new Date(nowSec * 1000).toISOString(),
  };
}
