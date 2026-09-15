import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchMarket, MarketError } from "@/lib/polymarket-markets";

export const runtime = "nodejs";

const CLOB = "https://clob.polymarket.com";
const query = z.object({
  slug: z.string().trim().min(1).max(240),
  startTs: z.coerce.number().int().positive().optional(),
  endTs: z.coerce.number().int().positive().optional(),
});

const historySchema = z.object({ history: z.array(z.object({ t: z.number(), p: z.number() })) });

/**
 * Price history for one market's Up/Yes outcome, read live from Polymarket.
 * Replaces the previous build-time JSON cache, which could not work on a
 * read-only serverless filesystem.
 */
export async function GET(req: NextRequest) {
  const parsed = query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Provide a market slug." }, { status: 400 });
  const { slug } = parsed.data;

  try {
    const market = await fetchMarket(slug);
    const up = market.outcomes.find(o => /^(up|yes)$/i.test(o.label)) ?? market.outcomes[0];
    if (!up) throw new MarketError("This market has no readable outcome.", 502);

    const endTs = parsed.data.endTs ?? Math.floor(Date.now() / 1000);
    const startTs = parsed.data.startTs ?? endTs - 86400;
    if (startTs >= endTs) return NextResponse.json({ error: "The start time must be before the end time." }, { status: 400 });

    const url = `${CLOB}/prices-history?${new URLSearchParams({ market: up.assetId, startTs: String(startTs), endTs: String(endTs), fidelity: "1" })}`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new MarketError("Price history is unavailable right now.", 502);
    const history = historySchema.safeParse(await res.json().catch(() => null));
    if (!history.success) throw new MarketError("Price history returned an unexpected format.", 502);

    return NextResponse.json({
      slug: market.slug,
      question: market.question,
      outcome: up.label,
      tokenId: up.assetId,
      history: history.data.history,
    }, { headers: { "Cache-Control": "public, max-age=30" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof MarketError ? error.message : "Price history could not be loaded." },
      { status: error instanceof MarketError ? error.status : 502 },
    );
  }
}
