import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { getMarket } from "@/lib/polymarket/markets";
import { getOrderBook } from "@/lib/polymarket/prices";

/** Public: one market with live best bid/ask per outcome. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const market = await getMarket((await params).slug);
    const books = market.tradable
      ? await Promise.all(market.outcomes.map((o) => getOrderBook(o.tokenId).catch(() => null)))
      : market.outcomes.map(() => null);
    const outcomes = market.outcomes.map((o, i) => {
      const book = books[i];
      const bid = book?.bids[0]?.price ?? null;
      const ask = book?.asks[0]?.price ?? null;
      return { ...o, bestBid: bid, bestAsk: ask, mid: bid !== null && ask !== null ? (bid + ask) / 2 : o.price };
    });
    return NextResponse.json({ market: { ...market, outcomes } }, { headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=15" } });
  } catch (error) {
    return fail(error);
  }
}
