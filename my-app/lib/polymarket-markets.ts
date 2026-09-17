import { z } from "zod";

const GAMMA = "https://gamma-api.polymarket.com";
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

export const buyInput = z.object({
  marketSlug: slugSchema, outcome: z.string().trim().min(1).max(120),
  amountUsd: z.number().finite().min(1).max(100).refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 1e-8, "Use whole cents."),
  maxPrice: z.number().finite().gt(0).lt(1),
});
export type BuyInput = z.infer<typeof buyInput>;
