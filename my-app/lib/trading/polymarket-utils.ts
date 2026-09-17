import { isAddress } from "viem";
import { fetchMarket } from "../polymarket-markets";

export const HOST = "https://clob.polymarket.com";
export const DATA_API_BASE = "https://data-api.polymarket.com";
export const GAMMA_API_BASE = "https://gamma-api.polymarket.com";
export const CHAIN_ID = 137;

export type PolymarketPosition = {
  asset: string;
  conditionId: string | null;
  title: string | null;
  size: number;
  avgPrice: number;
};

const tokenIdCache = new Map<
  string,
  { yesTokenId: string; noTokenId: string; cachedAt: number }
>();
const TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getTokenIds(
  slug: string,
): Promise<{ yesTokenId: string; noTokenId: string } | null> {
  const cached = tokenIdCache.get(slug);
  if (cached && Date.now() - cached.cachedAt < TOKEN_CACHE_TTL) {
    return { yesTokenId: cached.yesTokenId, noTokenId: cached.noTokenId };
  }
  try {
    const market = await fetchMarket(slug);
    const yes = market.outcomes.find(o => /^(yes|up)$/i.test(o.label));
    const no = market.outcomes.find(o => /^(no|down)$/i.test(o.label));
    if (!yes || !no) return null;
    const result = { yesTokenId: yes.assetId, noTokenId: no.assetId };
    if (tokenIdCache.size >= 500) tokenIdCache.delete(tokenIdCache.keys().next().value!);
    tokenIdCache.set(slug, { ...result, cachedAt: Date.now() });
    return result;
  } catch {
    // Failed lookup stays unknown. Data API has no market-by-slug endpoint.
    return null;
  }
}

/** Batch fetch prices for multiple tokens at once. */
export async function getBatchPrices(
  tokenIds: string[],
  side: "BUY" | "SELL",
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (tokenIds.length === 0) return result;

  try {
    const response = await fetch(`${HOST}/prices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tokenIds.map((id) => ({ token_id: id, side }))),
      signal: AbortSignal.timeout(10000),
    });
    const data = (await response.json()) as Record<string, Record<string, string>> | null;
    for (const id of tokenIds) {
      const price = parseFloat(data?.[id]?.[side] || "0");
      if (price > 0) result.set(id, price);
    }
  } catch {
    // Return whatever we have
  }
  return result;
}

/**
 * Read the complete set of positions for a Polymarket funder address.
 *
 * This endpoint is public and intentionally accepts an injected fetcher so
 * callers can test the response boundary without mocking fetch globally.
 * It never accepts credentials and returns null on malformed/upstream data so
 * a caller cannot mistake an unavailable response for an empty portfolio.
 */
export async function getCurrentPositions(
  funderAddress: string,
  fetcher: typeof fetch = fetch,
): Promise<PolymarketPosition[] | null> {
  if (!isAddress(funderAddress) || /^0x0{40}$/i.test(funderAddress)) return null;

  const url = new URL(`${DATA_API_BASE}/positions`);
  url.searchParams.set("user", funderAddress);

  try {
    const response = await fetcher(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;

    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) return null;

    return payload.flatMap((item): PolymarketPosition[] => {
      if (!item || typeof item !== "object") return [];
      const raw = item as Record<string, unknown>;
      const asset = raw.asset ?? raw.token_id ?? raw.tokenId;
      if (typeof asset !== "string" || asset.trim() === "") return [];

      const size = Number(raw.size ?? raw.shares ?? 0);
      const avgPrice = Number(raw.avgPrice ?? raw.avg_price ?? 0);
      if (!Number.isFinite(size) || !Number.isFinite(avgPrice)) return [];

      const conditionId = raw.conditionId ?? raw.condition_id;
      const title = raw.title ?? raw.question;
      return [{
        asset: asset.trim(),
        conditionId: typeof conditionId === "string" ? conditionId : null,
        title: typeof title === "string" ? title : null,
        size,
        avgPrice,
      }];
    });
  } catch {
    return null;
  }
}
