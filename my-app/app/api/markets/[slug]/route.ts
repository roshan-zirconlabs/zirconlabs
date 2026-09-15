import { NextRequest, NextResponse } from "next/server";
import { getPrices } from "@/lib/trading/polymarket-utils";
import { fetchMarket, MarketError } from "@/lib/polymarket-markets";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { slug } = await params;

  try {
    const market = await fetchMarket(slug);
    const yes = market.outcomes.find(o => /^(yes|up)$/i.test(o.label));
    const no = market.outcomes.find(o => /^(no|down)$/i.test(o.label));
    const tokenIds = yes && no ? { yesTokenId: yes.assetId, noTokenId: no.assetId } : null;

    let prices = null;
    if (tokenIds) {
      prices = await getPrices(tokenIds.yesTokenId, tokenIds.noTokenId);
    }

    return NextResponse.json({
      market: market || null,
      tokenIds,
      prices,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof MarketError ? error.message : "Failed to fetch market" },
      { status: error instanceof MarketError ? error.status : 502 },
    );
  }
}
