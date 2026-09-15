import { z } from "zod";

/**
 * A Polymarket strategy a non-technical user can describe, and that compiles to
 * a real KeeperHub workflow. Every field maps to something the runtime can
 * actually evaluate — there are no placeholder options here.
 */

export const ASSETS = ["BTC", "ETH"] as const;
export const TIMEFRAMES = ["15m", "1h", "4h", "1d"] as const;

export const CRON_FOR_TIMEFRAME: Record<(typeof TIMEFRAMES)[number], string> = {
  "15m": "*/15 * * * *",
  "1h": "5 * * * *",
  "4h": "5 */4 * * *",
  "1d": "5 0 * * *",
};

/** Rules are evaluated server-side against live candles; each is self-contained. */
export const RULES = [
  { id: "momentum", label: "Follow the trend", help: "Buy the direction the last candle moved." },
  { id: "reversal", label: "Bet against the last move", help: "Buy the opposite of the last candle." },
  { id: "sma-cross", label: "Moving-average crossover", help: "Buy UP while the fast average is above the slow average." },
  { id: "always-up", label: "Always buy UP", help: "No condition — buys UP every run. Useful for testing." },
  { id: "always-down", label: "Always buy DOWN", help: "No condition — buys DOWN every run. Useful for testing." },
] as const;

export const strategySpec = z.object({
  version: z.literal(1).default(1),
  asset: z.enum(ASSETS),
  timeframe: z.enum(TIMEFRAMES),
  rule: z.enum(RULES.map(r => r.id) as [string, ...string[]]),
  fastPeriod: z.number().int().min(2).max(100).default(9),
  slowPeriod: z.number().int().min(3).max(400).default(21),
  /** Stake per run, in collateral dollars. */
  stakeUsd: z.number().finite().min(1).max(100),
  /**
   * Refuse to buy above this price per share. Up/down markets move toward 0 or
   * 1 as the window closes, so a low cap silently skips most runs.
   */
  maxPrice: z.number().finite().gt(0).lt(1).default(0.95),
  /** Paper records a simulated fill; live submits a real signed CLOB order. */
  mode: z.enum(["paper", "live"]).default("paper"),
}).refine(s => s.slowPeriod > s.fastPeriod, {
  message: "The slow average must cover more candles than the fast average.",
  path: ["slowPeriod"],
});

export type StrategySpec = z.infer<typeof strategySpec>;

export type Candle = { ts: number; open: number; high: number; low: number; close: number };

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  let total = 0;
  for (let i = values.length - period; i < values.length; i += 1) total += values[i];
  return total / period;
}

export type SignalDecision = {
  direction: "UP" | "DOWN" | null;
  reason: string;
};

/**
 * Decides a direction from closed candles. Returns a null direction rather than
 * guessing when there is not enough history to evaluate the rule.
 */
export function evaluateRule(spec: StrategySpec, candles: Candle[]): SignalDecision {
  if (spec.rule === "always-up") return { direction: "UP", reason: "Unconditional UP strategy." };
  if (spec.rule === "always-down") return { direction: "DOWN", reason: "Unconditional DOWN strategy." };

  if (candles.length < 2) return { direction: null, reason: "Not enough candle history to evaluate the rule." };
  const closes = candles.map(c => c.close);
  const last = candles[candles.length - 1];
  const previous = candles[candles.length - 2];

  if (spec.rule === "momentum" || spec.rule === "reversal") {
    if (last.close === previous.close) return { direction: null, reason: "The last candle closed flat, so the rule has no direction." };
    const rose = last.close > previous.close;
    const direction = spec.rule === "momentum" ? (rose ? "UP" : "DOWN") : (rose ? "DOWN" : "UP");
    return { direction, reason: `Last close ${last.close} ${rose ? "above" : "below"} previous ${previous.close}.` };
  }

  const fast = sma(closes, spec.fastPeriod);
  const slow = sma(closes, spec.slowPeriod);
  if (fast === null || slow === null) {
    return { direction: null, reason: `Need at least ${spec.slowPeriod} candles to compare the moving averages.` };
  }
  if (fast === slow) return { direction: null, reason: "Moving averages are equal, so the rule has no direction." };
  return {
    direction: fast > slow ? "UP" : "DOWN",
    reason: `Fast SMA(${spec.fastPeriod})=${fast.toFixed(2)} is ${fast > slow ? "above" : "below"} slow SMA(${spec.slowPeriod})=${slow.toFixed(2)}.`,
  };
}

export function describeStrategy(spec: StrategySpec): string {
  const rule = RULES.find(r => r.id === spec.rule);
  const cadence = { "15m": "every 15 minutes", "1h": "hourly", "4h": "every 4 hours", "1d": "daily" }[spec.timeframe];
  return `${cadence}, stake $${spec.stakeUsd} on the ${spec.asset} ${spec.timeframe} up/down market using “${rule?.label ?? spec.rule}” (${spec.mode}).`;
}
