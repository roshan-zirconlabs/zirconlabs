import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readAccountReadiness } from "@/lib/polymarket/account-readiness";
import { tradingDepositWallet } from "@/lib/polymarket/account";

/** Read-only authenticated account readiness: collateral and approvals. */
export async function GET() {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const account = await prisma.polymarketManagedAccount.findUnique({ where: { userId: session.user.id } });
  if (!account) return NextResponse.json({ readiness: "ACCOUNT_REQUIRED" }, { status: 409 });
  try {
    const depositWallet = await tradingDepositWallet(account);
    return NextResponse.json(await readAccountReadiness(depositWallet), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ readiness: "UPSTREAM_UNAVAILABLE", error: "Could not read account balance and approvals. Balances are unknown; retry shortly." }, { status: 502 });
  }
}
