import { NextRequest, NextResponse } from "next/server";
import { OrderSide, OrderType } from "@polymarket/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createManagedPolymarketClient } from "@/lib/polymarket/live-client";
import { liveExecutionConfigured } from "@/lib/polymarket/managed-account";
import { z } from "zod";

const input = z.object({
  assetId: z.string().regex(/^0x[0-9a-f]+$|^[0-9]+$/i),
  amountUsd: z.coerce.number().finite().min(1).max(100),
  maxPrice: z.coerce.number().finite().gt(0).lt(1).optional(),
  confirm: z.literal(true),
});

/** Deliberately small, authenticated smoke-test endpoint. It places one BUY order. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!liveExecutionConfigured()) return NextResponse.json({ error: "Live execution is not enabled. Keep the launch flags off until the integration test is ready." }, { status: 503 });
  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Provide a token asset ID, an amount of at least $1, and confirm the test order." }, { status: 400 });
  const account = await prisma.polymarketManagedAccount.findUnique({ where: { userId: session.user.id } });
  if (!account || account.status !== "ACTIVE" || !account.liveEnabled) return NextResponse.json({ error: "Create, fund, and enable your Trading account first." }, { status: 409 });
  if (parsed.data.amountUsd > account.dailyLimitUsd) return NextResponse.json({ error: "This test order exceeds your daily spend limit." }, { status: 400 });
  try {
    const client = await createManagedPolymarketClient(account.providerWalletId, account.walletAddress);
    const response = await client.placeMarketOrder({ assetId: parsed.data.assetId, amount: parsed.data.amountUsd, maxPrice: parsed.data.maxPrice, side: OrderSide.BUY, orderType: OrderType.FAK });
    if (!response.ok) return NextResponse.json({ error: response.message, code: response.code }, { status: 502 });
    const hashes = response.transactionsHashes.length ? response.transactionsHashes : await client.waitForOrderFillSettlement(response);
    return NextResponse.json({ ok: true, orderId: response.orderId, status: response.status, tradeIds: response.tradeIds, transactionHashes: hashes, amountUsd: parsed.data.amountUsd });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Polymarket rejected the test order. No success receipt was generated." }, { status: 502 });
  }
}
