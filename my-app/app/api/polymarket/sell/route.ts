import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OrderSide, OrderType } from "@polymarket/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createManagedPolymarketClient } from "@/lib/polymarket/live-client";
import { liveExecutionConfigured } from "@/lib/polymarket/managed-account";
import { getCurrentPositions } from "@/lib/trading/polymarket-utils";
import { tradingDepositWallet } from "@/lib/polymarket/account";
import { resolveShares, sellInput, simulateSell, SellError } from "@/lib/polymarket/sell";
import { MarketError } from "@/lib/polymarket-markets";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };

const bookSchema = z.object({
  asset_id: z.string(),
  min_order_size: z.coerce.number().finite().positive(),
  bids: z.array(z.object({ price: z.string(), size: z.string() })),
});

async function readBook(assetId: string) {
  const res = await fetch(`https://clob.polymarket.com/book?${new URLSearchParams({ token_id: assetId })}`, {
    cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new MarketError("The order book is unavailable. Nothing was sold.", 502);
  const parsed = bookSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success || parsed.data.asset_id !== assetId) {
    throw new MarketError("The order book could not be verified for this position.", 502);
  }
  return parsed.data;
}

/**
 * Closes a position by selling outcome shares back to the book.
 *
 * Without this a position can only be exited by waiting for the market to
 * resolve, which means a losing position cannot be cut and a winning one
 * cannot be taken early.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = sellInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a position, an amount and a price floor, then confirm the sale." }, { status: 400, headers });
  }
  const input = parsed.data;

  if (!liveExecutionConfigured()) {
    return NextResponse.json({ error: "Live trading is not enabled on this deployment." }, { status: 503, headers });
  }
  const account = await prisma.polymarketManagedAccount.findUnique({ where: { userId: session.user.id } });
  if (!account || account.status !== "ACTIVE" || !account.liveEnabled) {
    return NextResponse.json({ error: "Enable live trading on your funded account first." }, { status: 409, headers });
  }

  // One sale per request reference, so a retry cannot sell the position twice.
  const previous = await prisma.trade.findUnique({ where: { keeperhubExecutionId: `sell:${input.requestId}` } });
  if (previous) {
    return NextResponse.json({ ok: true, duplicate: true, tradeId: previous.id, status: previous.status, message: "This sale was already submitted." }, { headers });
  }

  try {
    const depositWallet = await tradingDepositWallet(account);
    const positions = await getCurrentPositions(depositWallet);
    if (positions === null) return NextResponse.json({ error: "Polymarket positions are temporarily unavailable. Retry shortly." }, { status: 502, headers });
    const holding = positions.find(p => p.asset === input.assetId);
    if (!holding) return NextResponse.json({ error: "This wallet does not hold that position." }, { status: 409, headers });

    const book = await readBook(input.assetId);
    const shares = resolveShares(input.shares, holding.size, book.min_order_size);
    const quote = simulateSell(book.bids, shares, input.minPrice);

    const client = await createManagedPolymarketClient(account.providerWalletId, account.walletAddress);
    const response = await client.placeMarketOrder({
      assetId: input.assetId,
      side: OrderSide.SELL,
      shares,
      minPrice: input.minPrice,
      orderType: OrderType.FOK,
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Polymarket rejected this sale. Refresh the position and try again.", code: response.code }, { status: 409, headers });
    }

    const trade = await prisma.trade.create({ data: {
      userId: session.user.id, signal: "SELL", side: "SELL",
      direction: /down|no/i.test(holding.title ?? "") ? "DOWN" : "UP",
      marketSlug: holding.title ?? "polymarket", tokenId: input.assetId,
      amount: quote.proceeds, price: quote.price, shares,
      status: "PENDING", orderId: response.orderId, executedAt: new Date(), paper: false,
      keeperhubExecutionId: `sell:${input.requestId}`,
    } });

    return NextResponse.json({
      ok: true, tradeId: trade.id, orderId: response.orderId, status: response.status,
      shares, estimatedProceeds: Number(quote.proceeds.toFixed(6)), estimatedPrice: Number(quote.price.toFixed(6)),
      message: "Sale submitted. Your collateral balance updates once it settles.",
    }, { headers });
  } catch (error) {
    if (error instanceof SellError || error instanceof MarketError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers });
    }
    return NextResponse.json({
      error: "The sale may have reached Polymarket. Do not retry it. Check your positions and recent activity first.",
    }, { status: 202, headers });
  }
}
