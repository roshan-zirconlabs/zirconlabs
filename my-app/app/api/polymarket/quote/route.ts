import { NextResponse } from "next/server";
import { MarketError, buyInput, previewBuy } from "@/lib/polymarket-markets";

/** Public read-only estimate. This route never authenticates a signer or trades. */
export async function POST(request: Request) {
  const input = buyInput.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Choose a market, outcome, amount ($1–$100), and price limit." }, { status: 400 });
  try { return NextResponse.json(await previewBuy(input.data), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return NextResponse.json({ error: error instanceof MarketError ? error.message : "Order preview is temporarily unavailable." }, { status: error instanceof MarketError ? error.status : 502 }); }
}
