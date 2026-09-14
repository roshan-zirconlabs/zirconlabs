import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentPositions } from "@/lib/trading/polymarket-utils";

export async function GET() {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const account = await prisma.polymarketManagedAccount.findUnique({ where: { userId: session.user.id }, select: { walletAddress: true } });
  if (!account?.walletAddress) return NextResponse.json({ positions: [], readiness: "ACCOUNT_REQUIRED" });
  const positions = await getCurrentPositions(account.walletAddress);
  if (positions === null) return NextResponse.json({ error: "Polymarket positions are temporarily unavailable. Retry shortly." }, { status: 502 });
  return NextResponse.json({ positions, address: account.walletAddress, checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "private, max-age=15" } });
}
