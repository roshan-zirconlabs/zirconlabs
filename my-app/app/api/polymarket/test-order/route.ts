import { NextRequest, NextResponse } from "next/server";
import { OrderSide, OrderType } from "@polymarket/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createManagedPolymarketClient } from "@/lib/polymarket/live-client";
import { liveExecutionConfigured } from "@/lib/polymarket/managed-account";
import { readAccountReadiness } from "@/lib/polymarket/account-readiness";
import { reserveOrder } from "@/lib/polymarket/reserve-order";
import { MarketError, previewBuy } from "@/lib/polymarket-markets";
import { assertSameRequest, orderInput } from "@/lib/polymarket-orders";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };

/** One explicit, price-capped buy. The server resolves the selected outcome. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = orderInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a market, outcome, amount and price limit, then confirm the order." }, { status: 400 });
  const input = parsed.data;
  let attemptId: string | null = null;
  try {
    const previous = await prisma.polymarketOrderAttempt.findUnique({ where: { userId_requestId: { userId: session.user.id, requestId: input.requestId } } });
    if (previous) {
      assertSameRequest(previous, input);
      return NextResponse.json(previous.receipt ?? { ok: false, status: previous.status, requestId: input.requestId, message: "This request is already processing. Check its status; do not submit a new purchase." }, { status: previous.receipt ? 200 : 202, headers });
    }
    if (!liveExecutionConfigured()) return NextResponse.json({ error: "Live trading is not enabled on this deployment." }, { status: 503 });
    const account = await prisma.polymarketManagedAccount.findUnique({ where: { userId: session.user.id } });
    if (!account || account.status !== "ACTIVE" || !account.liveEnabled) return NextResponse.json({ error: "Create, fund and enable your trading account first." }, { status: 409 });
    const [quote, readiness] = await Promise.all([previewBuy(input), readAccountReadiness(account.walletAddress)]);
    if (!readiness.approvals.isFullyApproved) return NextResponse.json({ error: "Your account still needs trading approvals." }, { status: 409 });
    if (Number(readiness.balance) < input.amountUsd) return NextResponse.json({ error: "Your trading balance is below the order amount. Add funds and allow for trading fees." }, { status: 409 });
    const client = await createManagedPolymarketClient(account.providerWalletId, account.walletAddress);
    const reserved = await reserveOrder(session.user.id, input, quote.assetId);
    if (!reserved.created) return NextResponse.json(reserved.attempt.receipt ?? { ok: false, status: reserved.attempt.status, requestId: input.requestId, message: "This request is already processing." }, { status: reserved.attempt.receipt ? 200 : 202, headers });
    attemptId = reserved.attempt.id;
    const response = await client.placeMarketOrder({ assetId: quote.assetId, amount: input.amountUsd, maxPrice: input.maxPrice, side: OrderSide.BUY, orderType: OrderType.FOK });
    if (!response.ok) {
      const receipt = { ok: false, status: "REJECTED", requestId: input.requestId, error: "Polymarket rejected this order. Refresh your quote and check your account before placing another.", code: response.code };
      await prisma.polymarketOrderAttempt.update({ where: { id: attemptId }, data: { status: "REJECTED", receipt } });
      return NextResponse.json(receipt, { status: 409, headers });
    }
    const receipt = { ok: true, requestId: input.requestId, orderId: response.orderId, status: response.status, marketSlug: quote.marketSlug, outcome: quote.outcome, tradeIds: response.tradeIds, transactionHashes: response.transactionsHashes, amountUsd: input.amountUsd, settlement: "PENDING" };
    // Save acceptance before any settlement wait, so a timeout cannot lose the order.
    await prisma.polymarketOrderAttempt.update({ where: { id: attemptId }, data: { status: "ACCEPTED", orderId: response.orderId, receipt } });
    try {
      receipt.transactionHashes = await client.waitForOrderFillSettlement(response, { timeoutMs: 3000 });
      receipt.settlement = receipt.transactionHashes.length ? "RECEIPTS_AVAILABLE" : "NO_SETTLED_FILLS";
      await prisma.polymarketOrderAttempt.update({ where: { id: attemptId }, data: { receipt } });
    } catch { /* An accepted order remains accepted when settlement is delayed. */ }
    return NextResponse.json(receipt, { headers });
  } catch (error) {
    if (attemptId) {
      const receipt = { ok: false, status: "UNKNOWN", requestId: input.requestId, message: "The order may have reached Polymarket. Do not place it again. Check the order status and account activity first." };
      await prisma.polymarketOrderAttempt.update({ where: { id: attemptId }, data: { status: "UNKNOWN", receipt } }).catch(() => {});
      return NextResponse.json(receipt, { status: 202, headers });
    }
    return NextResponse.json({ error: error instanceof MarketError ? error.message : "Could not prepare the order. Check deployment migrations and account readiness, then retry." }, { status: error instanceof MarketError ? error.status : 503, headers });
  }
}

/** Read a prior request without re-posting an order to Polymarket. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requestId = req.nextUrl.searchParams.get("requestId");
  if (!requestId || requestId.length > 100) return NextResponse.json({ error: "Provide the request reference." }, { status: 400 });
  const attempt = await prisma.polymarketOrderAttempt.findUnique({ where: { userId_requestId: { userId: session.user.id, requestId } } });
  if (!attempt) return NextResponse.json({ error: "Order request not found." }, { status: 404 });
  return NextResponse.json(attempt.receipt ?? { ok: false, requestId, status: attempt.status, orderId: attempt.orderId, message: "Submission is still being checked." }, { headers });
}
