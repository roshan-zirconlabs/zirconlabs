import { fetchMarket, MarketError, type MarketChoice } from "../polymarket-markets";
import { TIMEFRAME_DURATION } from "../market-data";
import type { StrategySpec } from "./strategy";

/**
 * Resolves the up/down market that is open right now for an asset and
 * timeframe. Polymarket rotates these markets every window, so the slug is
 * derived from the current window and then verified against Gamma — a slug is
 * never assumed to exist.
 */

const ET = "America/New_York";

const LONG_NAME: Record<StrategySpec["asset"], string> = { BTC: "bitcoin", ETH: "ethereum" };
const SHORT_NAME: Record<StrategySpec["asset"], string> = { BTC: "btc", ETH: "eth" };

function etParts(startTs: number) {
  const d = new Date(startTs * 1000);
  const month = d.toLocaleString("en-US", { timeZone: ET, month: "long" }).toLowerCase();
  const day = d.toLocaleString("en-US", { timeZone: ET, day: "numeric" });
  const year = d.toLocaleString("en-US", { timeZone: ET, year: "numeric" });
  const hour = parseInt(d.toLocaleString("en-US", { timeZone: ET, hour: "numeric", hour12: false }), 10);
  const hourStr = hour === 0 ? "12am" : hour === 12 ? "12pm" : hour < 12 ? `${hour}am` : `${hour - 12}pm`;
  return { month, day, year, hourStr };
}

/** Candidate slugs for the window containing `nowSec`, most likely first. */
export function candidateSlugs(spec: Pick<StrategySpec, "asset" | "timeframe">, nowSec: number): string[] {
  const duration = TIMEFRAME_DURATION[spec.timeframe];
  const start = Math.floor(nowSec / duration) * duration;
  const short = SHORT_NAME[spec.asset];
  const long = LONG_NAME[spec.asset];

  if (spec.timeframe === "15m" || spec.timeframe === "4h") {
    // Epoch-keyed markets: also try the previous window, which is still the
    // live one for a few seconds around the boundary.
    return [`${short}-updown-${spec.timeframe}-${start}`, `${short}-updown-${spec.timeframe}-${start - duration}`];
  }
  const { month, day, year, hourStr } = etParts(start);
  if (spec.timeframe === "1h") {
    return [`${long}-up-or-down-${month}-${day}-${year}-${hourStr}-et`, `${long}-up-or-down-${month}-${day}-${hourStr}-et`];
  }
  return [`${long}-up-or-down-on-${month}-${day}-${year}`, `${long}-up-or-down-on-${month}-${day}`];
}

export type ResolvedMarket = {
  market: MarketChoice;
  slug: string;
  up: { label: string; assetId: string };
  down: { label: string; assetId: string };
};

function pickOutcome(market: MarketChoice, aliases: string[]) {
  return market.outcomes.find(o => aliases.includes(o.label.trim().toLowerCase())) ?? null;
}

/**
 * Returns the open market plus its UP/DOWN token ids. Throws rather than
 * returning a partial result: an unresolved outcome must never reach an order.
 */
export async function resolveActiveMarket(
  spec: Pick<StrategySpec, "asset" | "timeframe">,
  nowSec: number = Math.floor(Date.now() / 1000),
  fetcher: typeof fetch = fetch,
): Promise<ResolvedMarket> {
  const slugs = candidateSlugs(spec, nowSec);
  const failures: string[] = [];
  for (const slug of slugs) {
    let market: MarketChoice;
    try {
      market = await fetchMarket(slug, fetcher);
    } catch (error) {
      failures.push(`${slug}: ${error instanceof Error ? error.message : "lookup failed"}`);
      continue;
    }
    if (!market.tradable) { failures.push(`${slug}: not accepting orders`); continue; }
    const up = pickOutcome(market, ["up", "yes"]);
    const down = pickOutcome(market, ["down", "no"]);
    if (!up || !down || up.assetId === down.assetId) {
      failures.push(`${slug}: up/down outcomes could not be identified`);
      continue;
    }
    return { market, slug, up, down };
  }
  throw new MarketError(
    `No open ${spec.asset} ${spec.timeframe} up/down market right now. Checked ${slugs.length} candidate${slugs.length === 1 ? "" : "s"}.`,
    409,
  );
}
