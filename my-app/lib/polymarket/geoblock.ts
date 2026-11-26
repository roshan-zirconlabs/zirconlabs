/**
 * Polymarket decides whether an order may open a position from the IP that
 * sends it — for API orders that is this server, not the user. A server in a
 * close-only region (the US, the UK, Germany, France, Singapore, Australia…)
 * has every new buy rejected, so the region is checked before trading and
 * reported on /api/health.
 *
 * Source: https://docs.polymarket.com/developers/CLOB/geoblock (checked 2026-10-21).
 */

/** No new orders and no closing positions. */
const BLOCKED_COUNTRIES = new Set(["IR", "SY", "CU", "KP"]);
const BLOCKED_REGIONS = new Set(["UA-43", "UA-14", "UA-09"]);
/** Close-only on the API: existing positions can be sold, nothing new opened. */
const CLOSE_ONLY_COUNTRIES = new Set([
  "AU", "BY", "BE", "BI", "BR", "CF", "CD", "ET", "FR", "DE", "IQ", "IT", "LB", "LY", "MM", "NZ", "NI",
  "PL", "RU", "SG", "SO", "SK", "SS", "SD", "TW", "TH", "GB", "US", "UM", "VE", "YE", "ZW",
]);
const CLOSE_ONLY_REGIONS = new Set(["CA-BC", "CA-ON", "CA-AB", "CA-QC"]);

export type RegionStatus =
  | { status: "allowed"; country: string; region: string }
  | { status: "close-only" | "blocked"; country: string; region: string }
  | { status: "unknown"; error: string };

export class RegionBlockedError extends Error {
  constructor(public readonly region: Extract<RegionStatus, { status: "close-only" | "blocked" }>) {
    super(
      `This server is in a region where Polymarket only allows closing positions (${region.country}${region.region ? `-${region.region}` : ""}). ` +
      "No order was sent. Deploy the trading server to an allowed region (for example Dublin, dub1).",
    );
    this.name = "RegionBlockedError";
  }
}

export function classifyRegion(country: string, region: string, blockedFlag: boolean): RegionStatus["status"] {
  const c = country.toUpperCase();
  const sub = region ? `${c}-${region.toUpperCase()}` : "";
  if (BLOCKED_COUNTRIES.has(c) || BLOCKED_REGIONS.has(sub)) return "blocked";
  if (CLOSE_ONLY_COUNTRIES.has(c) || CLOSE_ONLY_REGIONS.has(sub)) return "close-only";
  // Polymarket's own flag wins over a list that may lag behind its policy.
  return blockedFlag ? "close-only" : "allowed";
}

let cached: { at: number; value: RegionStatus } | null = null;
const TTL_MS = 10 * 60 * 1000;

export async function readServerRegion(fetcher: typeof fetch = fetch): Promise<RegionStatus> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  let value: RegionStatus;
  try {
    const res = await fetcher("https://polymarket.com/api/geoblock", { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`geoblock check returned ${res.status}`);
    const body = await res.json() as { blocked?: unknown; country?: unknown; region?: unknown };
    const country = typeof body.country === "string" ? body.country : "";
    const region = typeof body.region === "string" ? body.region : "";
    if (!country) throw new Error("geoblock check returned no country");
    value = { status: classifyRegion(country, region, body.blocked === true), country, region } as RegionStatus;
  } catch (error) {
    value = { status: "unknown", error: error instanceof Error ? error.message : "geoblock check failed" };
  }
  cached = { at: Date.now(), value };
  return value;
}

/**
 * Throws before a live buy when this server cannot open positions. An
 * unreachable check does not block trading: Polymarket still enforces its own
 * rule on the order, so failing open only loses the clearer error message.
 */
export async function assertOrderRegionAllowed(fetcher: typeof fetch = fetch): Promise<void> {
  if (process.env.POLYMARKET_REGION_CHECK === "off") return;
  const region = await readServerRegion(fetcher);
  if (region.status === "close-only" || region.status === "blocked") throw new RegionBlockedError(region);
}
