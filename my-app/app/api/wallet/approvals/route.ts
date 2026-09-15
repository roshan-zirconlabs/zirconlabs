import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createManagedPolymarketClient } from "@/lib/polymarket/live-client";
import { managedWalletConfigured } from "@/lib/polymarket/managed-account";
import { readAccountReadiness } from "@/lib/polymarket/account-readiness";

export const runtime = "nodejs";
export const maxDuration = 120;
const headers = { "Cache-Control": "private, no-store" };

/**
 * Grants the ERC-20 and ERC-1155 approvals Polymarket requires before an
 * account can trade. These are on-chain transactions sent from the user's own
 * managed wallet; they authorise Polymarket's exchange contracts to move that
 * wallet's collateral and outcome tokens when an order fills.
 *
 * Approvals are a prerequisite for live trading, never a transfer of funds to
 * Zircon: the wallet keeps custody and Zircon holds no key.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (body?.confirm !== true) {
    return NextResponse.json({
      error: "Confirm the approval before it is sent. It authorises Polymarket's exchange contracts to settle your trades.",
    }, { status: 400, headers });
  }

  if (!managedWalletConfigured()) {
    return NextResponse.json({ error: "Managed trading accounts are not configured on this deployment." }, { status: 503, headers });
  }
  const account = await prisma.polymarketManagedAccount.findUnique({ where: { userId: session.user.id } });
  if (!account || account.status !== "ACTIVE") {
    return NextResponse.json({ error: "Create your trading account first." }, { status: 409, headers });
  }

  const before = await readAccountReadiness(account.walletAddress);
  if (before.approvals.isFullyApproved) {
    return NextResponse.json({ ok: true, alreadyApproved: true, readiness: before }, { headers });
  }

  try {
    const client = await createManagedPolymarketClient(account.providerWalletId, account.walletAddress);
    await client.setupTradingApprovals();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    // Approvals are ordinary Polygon transactions and need gas in the wallet.
    const needsGas = Number(before.nativeBalance) === 0;
    await prisma.polymarketManagedAccount.update({
      where: { userId: session.user.id },
      data: { lastCheckedAt: new Date(), lastError: detail.slice(0, 500) || "Approval setup failed." },
    }).catch(() => {});
    return NextResponse.json({
      error: needsGas
        ? "Your trading wallet has no POL for gas. Send a small amount of POL on Polygon to the wallet address, then try again."
        : "The approval transactions could not be completed. Nothing was approved; you can retry safely.",
      detail: detail.slice(0, 300) || undefined,
    }, { status: 502, headers });
  }

  const after = await readAccountReadiness(account.walletAddress);
  await prisma.polymarketManagedAccount.update({
    where: { userId: session.user.id },
    data: { lastCheckedAt: new Date(), lastError: after.approvals.isFullyApproved ? null : "Approvals are still incomplete." },
  }).catch(() => {});

  return NextResponse.json({ ok: after.approvals.isFullyApproved, readiness: after }, { headers });
}
