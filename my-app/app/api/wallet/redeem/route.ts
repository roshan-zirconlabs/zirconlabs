import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { redeemPositions } from "@polymarket/client/actions";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createManagedPolymarketClient } from "@/lib/polymarket/live-client";
import { managedWalletConfigured } from "@/lib/polymarket/managed-account";
import { getCurrentPositions } from "@/lib/trading/polymarket-utils";
import { readAccountReadiness } from "@/lib/polymarket/account-readiness";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
const GAMMA = "https://gamma-api.polymarket.com";

/** Markets whose outcome is settled, so their winning shares can be cashed in. */
async function resolvedConditionIds(conditionIds: string[]): Promise<Set<string>> {
  const settled = new Set<string>();
  await Promise.all(conditionIds.slice(0, 20).map(async id => {
    try {
      const res = await fetch(`${GAMMA}/markets?condition_ids=${encodeURIComponent(id)}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      const market = Array.isArray(data) ? data[0] : null;
      if (market && market.closed === true) settled.add(id);
    } catch { /* An unreadable market is simply not offered for redemption. */ }
  }));
  return settled;
}

/** Positions that can be cashed in right now. */
export async function GET() {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const account = await prisma.polymarketManagedAccount.findUnique({
    where: { userId: session.user.id }, select: { walletAddress: true },
  });
  if (!account) return NextResponse.json({ positions: [], redeemable: [] }, { headers });

  const positions = await getCurrentPositions(account.walletAddress);
  if (positions === null) {
    return NextResponse.json({ error: "Polymarket positions are temporarily unavailable. Retry shortly." }, { status: 502, headers });
  }
  const held = positions.filter(p => p.size > 0 && p.conditionId);
  const settled = await resolvedConditionIds([...new Set(held.map(p => p.conditionId as string))]);

  return NextResponse.json({
    positions: held.map(p => ({ ...p, resolved: settled.has(p.conditionId as string) })),
    redeemable: held.filter(p => settled.has(p.conditionId as string))
      .map(p => ({ conditionId: p.conditionId, title: p.title, size: p.size })),
    checkedAt: new Date().toISOString(),
  }, { headers });
}

const redeemInput = z.object({ conditionId: z.string().trim().regex(/^0x[0-9a-f]{64}$/i), confirm: z.literal(true) }).strict();

/**
 * Cashes a resolved market's winning shares back into collateral.
 *
 * Until this runs, a winning trade's value sits in outcome tokens rather than
 * spendable collateral, so it cannot be withdrawn.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = redeemInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a resolved market and confirm the redemption." }, { status: 400, headers });

  if (!managedWalletConfigured()) {
    return NextResponse.json({ error: "Managed trading accounts are not configured on this deployment." }, { status: 503, headers });
  }
  const account = await prisma.polymarketManagedAccount.findUnique({ where: { userId: session.user.id } });
  if (!account) return NextResponse.json({ error: "You do not have a trading account yet." }, { status: 409, headers });

  try {
    // Only redeem a market this wallet actually holds and that has settled.
    const positions = await getCurrentPositions(account.walletAddress);
    if (positions === null) return NextResponse.json({ error: "Polymarket positions are temporarily unavailable. Retry shortly." }, { status: 502, headers });
    const holding = positions.find(p => p.conditionId?.toLowerCase() === parsed.data.conditionId.toLowerCase() && p.size > 0);
    if (!holding) return NextResponse.json({ error: "This wallet does not hold a position in that market." }, { status: 409, headers });
    if (!(await resolvedConditionIds([parsed.data.conditionId])).size) {
      return NextResponse.json({ error: "That market has not resolved yet. Winnings can only be claimed after it settles." }, { status: 409, headers });
    }

    const readiness = await readAccountReadiness(account.walletAddress);
    if (Number(readiness.nativeBalance) <= 0) {
      return NextResponse.json({ error: "This wallet has no POL for the network fee. Send a small amount of POL on Polygon and retry." }, { status: 409, headers });
    }

    const client = await createManagedPolymarketClient(account.providerWalletId, account.walletAddress);
    const handle = await redeemPositions(client, { conditionId: parsed.data.conditionId });
    const txHash = handle.transactionHash;

    return NextResponse.json({
      ok: true, conditionId: parsed.data.conditionId, txHash,
      explorerUrl: txHash ? `https://polygonscan.com/tx/${txHash}` : null,
      message: "Redemption submitted. Your winnings become spendable collateral once it confirms.",
    }, { headers });
  } catch {
    return NextResponse.json({
      error: "The redemption could not be completed. Check your wallet's recent activity on Polygonscan before retrying.",
    }, { status: 502, headers });
  }
}
