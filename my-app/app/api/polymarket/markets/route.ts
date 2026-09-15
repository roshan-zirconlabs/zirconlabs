import { NextResponse } from "next/server";
import { MarketError, searchMarkets } from "@/lib/polymarket-markets";

export async function GET(request: Request) {
  try {
    return NextResponse.json({ markets: await searchMarkets(new URL(request.url).searchParams.get("q") ?? "") }, { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=15" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof MarketError ? error.message : "Market search is temporarily unavailable." }, { status: error instanceof MarketError ? error.status : 502 });
  }
}
