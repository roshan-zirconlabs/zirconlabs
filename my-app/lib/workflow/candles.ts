import { z } from "zod";
import type { Candle, StrategySpec } from "./strategy";

/** Closed candles for the asset/timeframe a strategy trades. */

const BINANCE = "https://api.binance.com/api/v3/klines";

const SYMBOL: Record<StrategySpec["asset"], string> = { BTC: "BTCUSDT", ETH: "ETHUSDT" };
const INTERVAL: Record<StrategySpec["timeframe"], string> = { "15m": "15m", "1h": "1h", "4h": "4h", "1d": "1d" };

const klineSchema = z.array(z.tuple([
  z.number(), z.string(), z.string(), z.string(), z.string(), z.string(), z.number(),
]).rest(z.unknown()));

export class CandleError extends Error {}

/**
 * Returns up to `limit` closed candles, oldest first. The still-forming candle
 * is dropped so a rule never reads a partial bar.
 */
export async function fetchCandles(
  spec: Pick<StrategySpec, "asset" | "timeframe">,
  limit: number,
  fetcher: typeof fetch = fetch,
): Promise<Candle[]> {
  const count = Math.min(Math.max(Math.floor(limit), 2) + 1, 1000);
  const url = `${BINANCE}?${new URLSearchParams({ symbol: SYMBOL[spec.asset], interval: INTERVAL[spec.timeframe], limit: String(count) })}`;
  let response: Response;
  try {
    response = await fetcher(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  } catch {
    throw new CandleError("Price history is temporarily unavailable. No signal was produced.");
  }
  if (!response.ok) throw new CandleError("Price history is temporarily unavailable. No signal was produced.");
  const parsed = klineSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new CandleError("Price history returned an unexpected format. No signal was produced.");

  const nowMs = Date.now();
  const candles: Candle[] = [];
  for (const k of parsed.data) {
    const [openMs, open, high, low, close, , closeMs] = k;
    if (closeMs >= nowMs) continue; // still forming
    const c = { ts: Math.floor(openMs / 1000), open: Number(open), high: Number(high), low: Number(low), close: Number(close) };
    if (![c.open, c.high, c.low, c.close].every(n => Number.isFinite(n) && n > 0)) {
      throw new CandleError("Price history contained an invalid candle. No signal was produced.");
    }
    candles.push(c);
  }
  if (candles.length < 2) throw new CandleError("Not enough closed candles to evaluate the strategy yet.");
  return candles;
}
