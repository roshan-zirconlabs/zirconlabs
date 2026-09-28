import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { searchMarkets } from "@/lib/polymarket/markets";

/** Public: search or trending markets. Cached briefly at the edge. */
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams.get("q") ?? "";
    const events = await searchMarkets(q);
    return NextResponse.json({ events }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } });
  } catch (error) {
    return fail(error);
  }
}
