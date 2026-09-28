import { z } from "zod";
import { MarketError } from "./markets";

const CLOB = "https://clob.polymarket.com";
const DATA = "https://data-api.polymarket.com";

export type Level = { price: number; size: number };
/** Bids best (highest) first, asks best (lowest) first. */
export type OrderBook = { tokenId: string; bids: Level[]; asks: Level[]; tickSize: number; minOrderSize: number };

const levels = z.array(z.object({ price: z.coerce.number(), size: z.coerce.number() }));

async function getJson(url: string, init: RequestInit, fetcher: typeof fetch) {
  let res: Response;
  try {
    res = await fetcher(url, { cache: "no-store", signal: AbortSignal.timeout(8000), ...init });
  } catch {
    throw new MarketError("Polymarket is not responding. Try again shortly.", 502);
  }
  if (!res.ok) throw new MarketError("Polymarket prices are temporarily unavailable.", 502);
  return res.json();
}

export async function getOrderBook(tokenId: string, fetcher: typeof fetch = fetch): Promise<OrderBook> {
  const raw = await getJson(`${CLOB}/book?token_id=${encodeURIComponent(tokenId)}`, {}, fetcher);
  const parsed = z.object({
    asset_id: z.string(), bids: levels, asks: levels,
    tick_size: z.coerce.number().optional(), min_order_size: z.coerce.number().optional(),
  }).safeParse(raw);
  if (!parsed.success || parsed.data.asset_id !== tokenId) throw new MarketError("The order book could not be verified for this outcome.", 502);
  const valid = (l: Level) => l.price > 0 && l.price < 1 && l.size > 0;
  return {
    tokenId,
    bids: parsed.data.bids.filter(valid).sort((a, b) => b.price - a.price),
    asks: parsed.data.asks.filter(valid).sort((a, b) => a.price - b.price),
    tickSize: parsed.data.tick_size && parsed.data.tick_size > 0 ? parsed.data.tick_size : 0.01,
    minOrderSize: parsed.data.min_order_size && parsed.data.min_order_size > 0 ? parsed.data.min_order_size : 5,
  };
}

/** Midpoint prices for many outcomes in as few requests as possible. Missing tokens are omitted. */
export async function getMidpoints(tokenIds: string[], fetcher: typeof fetch = fetch): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const unique = [...new Set(tokenIds)];
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const raw = await getJson(`${CLOB}/midpoints`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chunk.map((token_id) => ({ token_id }))),
    }, fetcher);
    for (const [token, value] of Object.entries((raw ?? {}) as Record<string, unknown>)) {
      const price = Number(value);
      if (chunk.includes(token) && Number.isFinite(price) && price > 0 && price < 1) out.set(token, price);
    }
  }
  return out;
}

export type LivePosition = {
  tokenId: string;
  conditionId: string;
  marketSlug: string;
  question: string;
  outcome: string;
  shares: number;
  avgPrice: number;
  price: number;
  valueUsd: number;
  costUsd: number;
  pnlUsd: number;
  /** Settled with value left to collect: the winning side of a resolved market. */
  claimable: boolean;
  endDate: string | null;
  image: string | null;
};

const positionSchema = z.object({
  asset: z.string(), conditionId: z.string(), size: z.coerce.number(), avgPrice: z.coerce.number(),
  curPrice: z.coerce.number(), currentValue: z.coerce.number(), initialValue: z.coerce.number(),
  cashPnl: z.coerce.number(), redeemable: z.boolean().optional(), title: z.string(), slug: z.string(),
  outcome: z.string(), endDate: z.string().nullish(), icon: z.string().nullish(),
}).passthrough();

/** Positions a wallet holds on Polymarket — the source of truth for the live book. */
export async function getLivePositions(address: string, fetcher: typeof fetch = fetch): Promise<LivePosition[]> {
  const raw = await getJson(`${DATA}/positions?user=${encodeURIComponent(address)}&sizeThreshold=0.01&limit=500`, {}, fetcher);
  if (!Array.isArray(raw)) throw new MarketError("Polymarket positions are temporarily unavailable.", 502);
  const out: LivePosition[] = [];
  for (const row of raw) {
    const p = positionSchema.safeParse(row);
    if (!p.success || p.data.size <= 0) continue;
    const d = p.data;
    out.push({
      tokenId: d.asset, conditionId: d.conditionId, marketSlug: d.slug, question: d.title, outcome: d.outcome,
      shares: d.size, avgPrice: d.avgPrice, price: d.curPrice, valueUsd: d.currentValue, costUsd: d.initialValue,
      pnlUsd: d.cashPnl,
      // Polymarket marks losing positions redeemable too; only winners have value to collect.
      claimable: d.redeemable === true && d.currentValue > 0.000001,
      endDate: d.endDate ?? null, image: d.icon ?? null,
    });
  }
  return out;
}
