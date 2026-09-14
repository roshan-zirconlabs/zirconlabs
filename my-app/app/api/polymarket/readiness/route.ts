import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createManagedPolymarketClient } from "@/lib/polymarket/live-client";

/** Read-only authenticated account readiness: collateral and approvals. */
export async function GET() {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const account = await prisma.polymarketManagedAccount.findUnique({ where: { userId: session.user.id } });
  if (!account) return NextResponse.json({ readiness: "ACCOUNT_REQUIRED" }, { status: 409 });
  try {
    const client = await createManagedPolymarketClient(account.providerWalletId, account.walletAddress);
    const approvals = await client.fetchTradingApprovalsState();
    return NextResponse.json({ readiness: "READY_TO_REVIEW", address: account.walletAddress, approvals, checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ readiness: "UPSTREAM_UNAVAILABLE", error: error instanceof Error ? error.message : "Could not read Polymarket account readiness." }, { status: 502 });
  }
}
