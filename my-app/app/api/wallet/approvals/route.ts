import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { managedWalletConfigured } from "@/lib/polymarket/managed-account";
import { readAccountReadiness } from "@/lib/polymarket/account-readiness";
import { tradingDepositWallet } from "@/lib/polymarket/account";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

/**
 * A Polymarket Deposit Wallet trades through the gasless relayer and is
 * pre-authorized, so there is no on-chain approval step to run. This endpoint
 * stays for the client's readiness flow and simply reports the funded state.
 */
export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!managedWalletConfigured()) {
    return NextResponse.json({ error: "Managed trading accounts are not configured on this deployment." }, { status: 503, headers });
  }
  const account = await prisma.polymarketManagedAccount.findUnique({ where: { userId: session.user.id } });
  if (!account || account.status !== "ACTIVE") {
    return NextResponse.json({ error: "Create your trading account first." }, { status: 409, headers });
  }
  const depositWallet = await tradingDepositWallet(account);
  const readiness = await readAccountReadiness(depositWallet);
  return NextResponse.json({ ok: true, alreadyApproved: true, readiness }, { headers });
}
