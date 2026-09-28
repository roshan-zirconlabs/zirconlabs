import { z } from "zod";

/**
 * Polymarket market data from the public Gamma API.
 *
 * Everything here is read-only and needs no credentials. Markets are always
 * re-read on the server before an order or automation is created: a token id
 * or price sent by a browser is never trusted.
 */

const GAMMA = "https://gamma-api.polymarket.com";

export class MarketError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "MarketError";
  }
}

export type FeeSchedule = { rate: number; exponent: number };

export type Outcome = { label: string; tokenId: string; price: number | null };

export type Market = {
  slug: string;
  question: string;
  conditionId: string;
  eventSlug: string | null;
  eventTitle: string | null;
  image: string | null;
  endDate: string | null;
  active: boolean;
  closed: boolean;
  /** Open and accepting orders right now. */
  tradable: boolean;
  /** Settled on-chain; `winner` is the winning outcome label. */
  resolved: boolean;
  winner: string | null;
  negRisk: boolean;
  tickSize: number;
  minOrderSize: number;
  /** Taker fee, or null when the market charges none. */
  fee: FeeSchedule | null;
  volume24h: number;
  outcomes: Outcome[];
};

export const slugSchema = z.string().trim().min(1).max(240).regex(/^[a-zA-Z0-9_-]+$/);

// Gamma encodes arrays as JSON strings; they are paired by position.
const jsonArray = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return null; }
}, z.array(z.string()));

const num = z.preprocess((v) => (v === null || v === undefined || v === "" ? undefined : Number(v)), z.number().finite().optional());

const rawMarket = z.object({
  slug: slugSchema,
  question: z.string().min(1),
  conditionId: z.string().regex(/^0x[0-9a-f]{64}$/i),
  outcomes: jsonArray,
  clobTokenIds: jsonArray,
  outcomePrices: jsonArray.optional(),
  image: z.string().nullish(),
  icon: z.string().nullish(),
  endDate: z.string().nullish(),
  active: z.boolean().optional(),
  closed: z.boolean().optional(),
  archived: z.boolean().optional(),
  acceptingOrders: z.boolean().optional(),
  enableOrderBook: z.boolean().optional(),
  negRisk: z.boolean().optional(),
  umaResolutionStatus: z.string().nullish(),
  orderPriceMinTickSize: num,
  orderMinSize: num,
  volume24hr: num,
  feesEnabled: z.boolean().optional(),
  feeSchedule: z.object({ rate: z.number(), exponent: z.number().optional() }).nullish(),
  events: z.array(z.object({ slug: z.string().optional(), title: z.string().optional() })).optional(),
}).passthrough();

/** Normalises one Gamma market. Throws rather than guessing when outcomes don't line up. */
export function parseMarket(raw: unknown, event?: { slug?: string; title?: string }): Market {
  const parsed = rawMarket.safeParse(raw);
  if (!parsed.success) throw new MarketError("Polymarket returned incomplete market details.", 502);
  const m = parsed.data;
  if (
    m.outcomes.length < 2 ||
    m.outcomes.length !== m.clobTokenIds.length ||
    new Set(m.clobTokenIds).size !== m.clobTokenIds.length ||
    m.clobTokenIds.some((t) => !/^[0-9]+$/.test(t))
  ) {
    throw new MarketError("This market's outcomes could not be matched reliably.", 502);
  }
  const prices = m.outcomePrices?.length === m.outcomes.length ? m.outcomePrices.map(Number) : null;
  const closed = m.closed === true;
  const resolved = closed && m.umaResolutionStatus === "resolved" && prices !== null && prices.some((p) => p >= 0.99);
  const ev = event ?? m.events?.[0];
  return {
    slug: m.slug,
    question: m.question,
    conditionId: m.conditionId,
    eventSlug: ev?.slug ?? null,
    eventTitle: ev?.title ?? null,
    image: m.image || m.icon || null,
    endDate: m.endDate ?? null,
    active: m.active === true,
    closed,
    tradable: m.active === true && !closed && m.archived !== true && m.acceptingOrders === true && m.enableOrderBook === true,
    resolved,
    winner: resolved && prices ? m.outcomes[prices.findIndex((p) => p >= 0.99)] : null,
    negRisk: m.negRisk === true,
    tickSize: m.orderPriceMinTickSize && m.orderPriceMinTickSize > 0 ? m.orderPriceMinTickSize : 0.01,
    minOrderSize: m.orderMinSize && m.orderMinSize > 0 ? m.orderMinSize : 5,
    fee: m.feesEnabled && m.feeSchedule && m.feeSchedule.rate > 0 ? { rate: m.feeSchedule.rate, exponent: m.feeSchedule.exponent ?? 1 } : null,
    volume24h: m.volume24hr ?? 0,
    outcomes: m.outcomes.map((label, i) => ({
      label,
      tokenId: m.clobTokenIds[i],
      price: prices && Number.isFinite(prices[i]) ? prices[i] : null,
    })),
  };
}

async function gamma(path: string, fetcher: typeof fetch): Promise<unknown> {
  let res: Response;
  try {
    res = await fetcher(`${GAMMA}${path}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  } catch {
    throw new MarketError("Polymarket is not responding. Try again shortly.", 502);
  }
  if (res.status === 404) throw new MarketError("That market doesn't exist or was removed.", 404);
  if (!res.ok) throw new MarketError("Polymarket is temporarily unavailable. Try again shortly.", 502);
  return res.json();
}

export async function getMarket(slug: string, fetcher: typeof fetch = fetch): Promise<Market> {
  if (!slugSchema.safeParse(slug).success) throw new MarketError("That isn't a valid market link.");
  const market = parseMarket(await gamma(`/markets/slug/${encodeURIComponent(slug)}`, fetcher));
  if (market.slug !== slug) throw new MarketError("Market identity changed. Search for it again.", 502);
  return market;
}

/** A market plus one of its outcomes, re-read from Polymarket. */
export async function resolveOutcome(slug: string, outcome: string, fetcher: typeof fetch = fetch) {
  const market = await getMarket(slug, fetcher);
  const choice = market.outcomes.find((o) => o.label.toLowerCase() === outcome.trim().toLowerCase());
  if (!choice) throw new MarketError("Choose one of this market's outcomes.");
  return { market, outcome: choice };
}

export type EventGroup = { slug: string; title: string; image: string | null; volume24h: number; markets: Market[] };

function toGroups(events: unknown): EventGroup[] {
  if (!Array.isArray(events)) return [];
  const groups: EventGroup[] = [];
  for (const e of events as Array<Record<string, unknown>>) {
    const markets: Market[] = [];
    for (const raw of Array.isArray(e.markets) ? e.markets : []) {
      try {
        const m = parseMarket(raw, { slug: String(e.slug ?? ""), title: String(e.title ?? "") });
        if (m.tradable) markets.push(m);
      } catch { /* Skip a malformed market rather than failing the whole list. */ }
    }
    if (!markets.length) continue;
    markets.sort((a, b) => b.volume24h - a.volume24h);
    groups.push({
      slug: String(e.slug ?? markets[0].slug),
      title: String(e.title ?? markets[0].question),
      image: typeof e.image === "string" ? e.image : markets[0].image,
      volume24h: Number(e.volume24hr ?? 0) || markets.reduce((s, m) => s + m.volume24h, 0),
      markets: markets.slice(0, 12),
    });
  }
  return groups;
}

export async function searchMarkets(query: string, fetcher: typeof fetch = fetch): Promise<EventGroup[]> {
  const q = query.trim().slice(0, 100);
  if (!q) return trendingMarkets(fetcher);
  const data = (await gamma(`/public-search?q=${encodeURIComponent(q)}&limit_per_type=12&events_status=active`, fetcher)) as { events?: unknown };
  return toGroups(data.events);
}

export async function trendingMarkets(fetcher: typeof fetch = fetch): Promise<EventGroup[]> {
  return toGroups(await gamma("/events?active=true&closed=false&order=volume24hr&ascending=false&limit=24", fetcher));
}
