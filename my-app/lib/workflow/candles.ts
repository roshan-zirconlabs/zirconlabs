import { z } from "zod";
import type { Candle, StrategySpec } from "./strategy";

/**
 * Closed candles for the asset and timeframe a strategy trades.
 *
 * Several exchanges are tried in order because no single one is reachable
 * everywhere: Binance geo-blocks many cloud regions, and Bitstamp rate-limits
 * aggressively. A strategy that cannot read prices must not trade, so the
 * chain fails closed rather than returning partial history.
 */

export class CandleError extends Error {}

type Asset = StrategySpec["asset"];
type Timeframe = StrategySpec["timeframe"];

export const TIMEFRAME_SECONDS: Record<Timeframe, number> = { "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400 };

type Provider = {
  name: string;
  /** Returns candles oldest-first, or null when this provider cannot serve them. */
  fetch: (asset: Asset, timeframe: Timeframe, limit: number, fetcher: typeof fetch) => Promise<Candle[] | null>;
};

function finite(...values: number[]) {
  return values.every(v => Number.isFinite(v) && v > 0);
}

async function readJson(url: string, fetcher: typeof fetch): Promise<unknown | null> {
  try {
    const res = await fetcher(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json", "User-Agent": "zircon-labs" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Binance ────────────────────────────────────────────────────────────────
const BINANCE_SYMBOL: Record<Asset, string> = { BTC: "BTCUSDT", ETH: "ETHUSDT" };
const binanceSchema = z.array(z.tuple([z.number(), z.string(), z.string(), z.string(), z.string(), z.string(), z.number()]).rest(z.unknown()));

const binance: Provider = {
  name: "binance",
  async fetch(asset, timeframe, limit, fetcher) {
    const url = `https://api.binance.com/api/v3/klines?symbol=${BINANCE_SYMBOL[asset]}&interval=${timeframe}&limit=${limit}`;
    const parsed = binanceSchema.safeParse(await readJson(url, fetcher));
    if (!parsed.success) return null;
    const now = Date.now();
    const out: Candle[] = [];
    for (const [openMs, open, high, low, close, , closeMs] of parsed.data) {
      if (closeMs >= now) continue; // still forming
      const c = { ts: Math.floor(openMs / 1000), open: +open, high: +high, low: +low, close: +close };
      if (!finite(c.open, c.high, c.low, c.close)) return null;
      out.push(c);
    }
    return out;
  },
};

// ── Coinbase ───────────────────────────────────────────────────────────────
const COINBASE_PRODUCT: Record<Asset, string> = { BTC: "BTC-USD", ETH: "ETH-USD" };
/** Coinbase has no 4h granularity, so 4h is aggregated from 1h below. */
const COINBASE_GRANULARITY: Partial<Record<Timeframe, number>> = { "15m": 900, "1h": 3600, "1d": 86400 };
const coinbaseSchema = z.array(z.tuple([z.number(), z.number(), z.number(), z.number(), z.number()]).rest(z.unknown()));

async function coinbaseCandles(asset: Asset, granularity: number, fetcher: typeof fetch): Promise<Candle[] | null> {
  const url = `https://api.exchange.coinbase.com/products/${COINBASE_PRODUCT[asset]}/candles?granularity=${granularity}`;
  const parsed = coinbaseSchema.safeParse(await readJson(url, fetcher));
  if (!parsed.success) return null;
  const now = Math.floor(Date.now() / 1000);
  const out: Candle[] = [];
  // Coinbase returns [time, low, high, open, close, volume], newest first.
  for (const [time, low, high, open, close] of parsed.data) {
    if (time + granularity > now) continue; // still forming
    if (!finite(open, high, low, close)) return null;
    out.push({ ts: time, open, high, low, close });
  }
  return out.sort((a, b) => a.ts - b.ts);
}

/** Combines whole groups of smaller candles into one larger bar. */
export function aggregateCandles(candles: Candle[], fromSeconds: number, toSeconds: number): Candle[] {
  const factor = Math.round(toSeconds / fromSeconds);
  if (factor < 2 || factor * fromSeconds !== toSeconds) return [];
  const buckets = new Map<number, Candle[]>();
  for (const c of candles) {
    const start = Math.floor(c.ts / toSeconds) * toSeconds;
    const bucket = buckets.get(start);
    if (bucket) bucket.push(c); else buckets.set(start, [c]);
  }
  const out: Candle[] = [];
  for (const [start, group] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
    // A partial bucket would misreport the bar, so it is dropped.
    if (group.length !== factor) continue;
    group.sort((a, b) => a.ts - b.ts);
    out.push({
      ts: start,
      open: group[0].open,
      close: group[group.length - 1].close,
      high: Math.max(...group.map(c => c.high)),
      low: Math.min(...group.map(c => c.low)),
    });
  }
  return out;
}

const coinbase: Provider = {
  name: "coinbase",
  async fetch(asset, timeframe, _limit, fetcher) {
    const granularity = COINBASE_GRANULARITY[timeframe];
    if (granularity) return coinbaseCandles(asset, granularity, fetcher);
    if (timeframe === "4h") {
      const hourly = await coinbaseCandles(asset, 3600, fetcher);
      return hourly ? aggregateCandles(hourly, 3600, TIMEFRAME_SECONDS["4h"]) : null;
    }
    return null;
  },
};

// ── Bitstamp ───────────────────────────────────────────────────────────────
const BITSTAMP_PAIR: Record<Asset, string> = { BTC: "btcusd", ETH: "ethusd" };
const bitstampSchema = z.object({
  data: z.object({
    ohlc: z.array(z.object({ timestamp: z.string(), open: z.string(), high: z.string(), low: z.string(), close: z.string() })),
  }),
});

const bitstamp: Provider = {
  name: "bitstamp",
  async fetch(asset, timeframe, limit, fetcher) {
    const step = TIMEFRAME_SECONDS[timeframe];
    const url = `https://www.bitstamp.net/api/v2/ohlc/${BITSTAMP_PAIR[asset]}/?step=${step}&limit=${Math.min(limit, 1000)}`;
    const parsed = bitstampSchema.safeParse(await readJson(url, fetcher));
    if (!parsed.success) return null;
    const now = Math.floor(Date.now() / 1000);
    const out: Candle[] = [];
    for (const row of parsed.data.data.ohlc) {
      const ts = Number(row.timestamp);
      if (!Number.isFinite(ts) || ts + step > now) continue; // still forming
      const c = { ts, open: +row.open, high: +row.high, low: +row.low, close: +row.close };
      if (!finite(c.open, c.high, c.low, c.close)) return null;
      out.push(c);
    }
    return out.sort((a, b) => a.ts - b.ts);
  },
};

export const PROVIDERS: Provider[] = [binance, coinbase, bitstamp];

/**
 * Returns at least `limit` closed candles, oldest first. The still-forming
 * candle is always dropped so a rule never reads a partial bar.
 */
export async function fetchCandles(
  spec: Pick<StrategySpec, "asset" | "timeframe">,
  limit: number,
  fetcher: typeof fetch = fetch,
  providers: Provider[] = PROVIDERS,
): Promise<Candle[]> {
  const want = Math.min(Math.max(Math.floor(limit), 2) + 1, 1000);
  const tried: string[] = [];
  for (const provider of providers) {
    tried.push(provider.name);
    const candles = await provider.fetch(spec.asset, spec.timeframe, want, fetcher);
    if (candles && candles.length >= 2) return candles;
  }
  throw new CandleError(`Price history is unavailable from every source (tried ${tried.join(", ")}). No signal was produced.`);
}
