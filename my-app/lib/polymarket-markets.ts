import { z } from "zod";
import { simulateBuy } from "./paper-fill";

const GAMMA = "https://gamma-api.polymarket.com";
const CLOB = "https://clob.polymarket.com";
const slugSchema = z.string().trim().min(1).max(240).regex(/^[a-zA-Z0-9_-]+$/);
const stringArray = z.preprocess(value => {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return null; }
}, z.array(z.string().min(1)).min(2));
const marketSchema = z.object({
  slug: slugSchema, question: z.string().min(1), conditionId: z.string().regex(/^0x[0-9a-f]{64}$/i),
  outcomes: stringArray, clobTokenIds: stringArray,
  active: z.boolean(), closed: z.boolean(), acceptingOrders: z.boolean().optional(),
  enableOrderBook: z.boolean().optional(), archived: z.boolean().optional(),
});

export class MarketError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export type MarketChoice = {
  slug: string; question: string; conditionId: string; tradable: boolean;
  outcomes: { label: string; assetId: string }[];
};

/** Gamma's arrays are paired by position, not by assuming the first means Yes. */
export function parseMarket(raw: unknown): MarketChoice {
  const parsed = marketSchema.safeParse(raw);
  if (!parsed.success) throw new MarketError("Polymarket returned incomplete market details. Try another market or refresh.", 502);
  const m = parsed.data;
  if (m.outcomes.length !== m.clobTokenIds.length || new Set(m.outcomes.map(o => o.toLowerCase())).size !== m.outcomes.length || new Set(m.clobTokenIds).size !== m.clobTokenIds.length || m.clobTokenIds.some(t => !/^[0-9]+$/.test(t))) throw new MarketError("Market outcomes could not be matched reliably. Refresh before trading.", 502);
  return { slug: m.slug, question: m.question, conditionId: m.conditionId, tradable: m.active && !m.closed && !m.archived && m.acceptingOrders === true && m.enableOrderBook === true, outcomes: m.outcomes.map((label, i) => ({ label, assetId: m.clobTokenIds[i] })) };
}

async function readJson(url: string, fetcher: typeof fetch) {
  const response = await fetcher(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new MarketError(response.status === 404 ? "This market is unavailable. Choose another market." : "Polymarket is temporarily unavailable. Retry shortly.", response.status === 404 ? 404 : 502);
  return response.json() as Promise<unknown>;
}

export async function fetchMarket(slug: string, fetcher: typeof fetch = fetch) {
  if (!slugSchema.safeParse(slug).success) throw new MarketError("Choose a valid market.");
  const market = parseMarket(await readJson(`${GAMMA}/markets/slug/${encodeURIComponent(slug)}`, fetcher));
  if (market.slug !== slug) throw new MarketError("Market identity changed. Search for the market again.", 502);
  return market;
}

export async function resolveMarketSelection(slug: string, outcome: string, fetcher: typeof fetch = fetch) {
  const market = await fetchMarket(slug, fetcher);
  if (!market.tradable) throw new MarketError("This market is closed or is not accepting orders.", 409);
  const choice = market.outcomes.find(o => o.label.toLowerCase() === outcome.trim().toLowerCase());
  if (!choice) throw new MarketError("Choose one of this market's available outcomes.");
  return { market, ...choice };
}

export async function searchMarkets(query: string, fetcher: typeof fetch = fetch) {
  const q = query.trim();
  if (q.length > 120) throw new MarketError("Search must be 120 characters or fewer.");
  const url = q ? `${GAMMA}/public-search?${new URLSearchParams({ q, events_status: "active", limit_per_type: "8", search_profiles: "false", search_tags: "false" })}` : `${GAMMA}/markets?active=true&closed=false&limit=30&order=volume24hr&ascending=false`;
  const data = await readJson(url, fetcher);
  const envelope = z.object({ events: z.array(z.object({ markets: z.array(z.unknown()).optional() })).optional() });
  let candidates: unknown[];
  if (q) {
    const result = envelope.safeParse(data);
    if (!result.success) throw new MarketError("Polymarket search returned an invalid response.", 502);
    candidates = (result.data.events ?? []).flatMap(e => e.markets ?? []);
  } else {
    if (!Array.isArray(data)) throw new MarketError("Polymarket search returned an invalid response.", 502);
    candidates = data;
  }
  const markets = new Map<string, MarketChoice>();
  for (const raw of candidates) {
    try { const market = parseMarket(raw); if (market.tradable) markets.set(market.slug, market); } catch { /* Search may contain incomplete or non-orderbook markets. */ }
  }
  return [...markets.values()].slice(0, 30);
}

export const buyInput = z.object({
  marketSlug: slugSchema, outcome: z.string().trim().min(1).max(120),
  amountUsd: z.number().finite().min(1).max(100).refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 1e-8, "Use whole cents."),
  maxPrice: z.number().finite().gt(0).lt(1),
});
export type BuyInput = z.infer<typeof buyInput>;

export async function previewBuy(input: BuyInput, fetcher: typeof fetch = fetch) {
  const parsed = buyInput.safeParse(input);
  if (!parsed.success) throw new MarketError("Choose a market, outcome, amount ($1–$100), and price limit between 0 and 1.");
  const { market, assetId, label } = await resolveMarketSelection(input.marketSlug, input.outcome, fetcher);
  const raw = await readJson(`${CLOB}/book?${new URLSearchParams({ token_id: assetId })}`, fetcher);
  const schema = z.object({ asset_id: z.string(), min_order_size: z.coerce.number().finite().positive(), tick_size: z.coerce.number().finite().positive(), asks: z.array(z.object({ price: z.string(), size: z.string() })) });
  const result = schema.safeParse(raw);
  if (!result.success || result.data.asset_id !== assetId) throw new MarketError("Order book could not be verified for your selection.", 502);
  const book = result.data;
  const ticks = input.maxPrice / book.tick_size;
  if (Math.abs(ticks - Math.round(ticks)) > 1e-8) throw new MarketError(`Price limit must use increments of ${book.tick_size}.`);
  let fill;
  try { fill = simulateBuy(book.asks, input.amountUsd, input.maxPrice); }
  catch { throw new MarketError("Not enough shares are available within your price limit. Increase the limit or choose another market.", 409); }
  if (fill.shares + 1e-8 < book.min_order_size) throw new MarketError(`This market requires at least ${book.min_order_size} shares. Increase your amount.`, 409);
  return { marketSlug: market.slug, question: market.question, outcome: label, assetId, amountUsd: input.amountUsd, maxPrice: input.maxPrice, estimatedShares: fill.shares, estimatedAveragePrice: fill.price, minimumShares: book.min_order_size, tickSize: book.tick_size, checkedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 30000).toISOString(), note: "Estimate before trading fees. Prices and availability may change before execution." };
}
