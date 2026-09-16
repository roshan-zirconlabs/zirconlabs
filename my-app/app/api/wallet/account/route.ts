import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ManagedWalletError, liveExecutionConfigured, managedWalletConfigured, provisionManagedWallet } from "@/lib/polymarket/managed-account";
import { z } from "zod";
import { tradingDepositWallet } from "@/lib/polymarket/account";

const controls = z.object({ liveEnabled: z.boolean().optional(), dailyLimitUsd: z.coerce.number().finite().min(1).max(10000).optional() });

function view(account: { id: string; walletAddress: string; depositWalletAddress: string | null; provider: string; status: string; liveEnabled: boolean; dailyLimitUsd: number; createdAt: Date; lastCheckedAt: Date | null; lastError: string | null } | null) {
  if (!account) return null;
  return { id: account.id, address: account.walletAddress, depositAddress: account.depositWalletAddress, provider: account.provider, status: account.status, liveEnabled: account.liveEnabled, dailyLimitUsd: account.dailyLimitUsd, createdAt: account.createdAt.toISOString(), lastCheckedAt: account.lastCheckedAt?.toISOString() ?? null, lastError: account.lastError };
}

export async function GET() {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const account = await prisma.polymarketManagedAccount.findUnique({ where: { userId: session.user.id } });
  if (account && !account.depositWalletAddress && managedWalletConfigured()) {
    try { account.depositWalletAddress = await tradingDepositWallet(account); } catch { /* resolved on demand later */ }
  }
  return NextResponse.json({ account: view(account), configured: managedWalletConfigured() }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST() {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const existing = await prisma.polymarketManagedAccount.findUnique({ where: { userId: session.user.id } });
  if (existing) return NextResponse.json({ account: view(existing), created: false });
  try {
    const wallet = await provisionManagedWallet(session.user.id, session.user.email);
    const account = await prisma.polymarketManagedAccount.create({ data: { userId: session.user.id, providerWalletId: wallet.id, walletAddress: wallet.address, status: "ACTIVE" } });
    return NextResponse.json({ account: view(account), created: true }, { status: 201 });
  } catch (error) {
    if (error instanceof ManagedWalletError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: "Could not create your trading account. No wallet was saved; retry shortly." }, { status: 502 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = controls.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid daily limit and live-trading setting." }, { status: 400 });
  const existing = await prisma.polymarketManagedAccount.findUnique({ where: { userId: session.user.id } });
  if (!existing) return NextResponse.json({ error: "Create your trading account first." }, { status: 404 });
  if (parsed.data.liveEnabled === true && !liveExecutionConfigured()) return NextResponse.json({ error: "Live trading is not enabled on this deployment yet. Finish the signed CLOB V2 integration test first." }, { status: 409 });
  if (parsed.data.liveEnabled === true && existing.status !== "ACTIVE") return NextResponse.json({ error: "Your account must be active before live trading can be enabled." }, { status: 409 });
  const account = await prisma.polymarketManagedAccount.update({ where: { userId: session.user.id }, data: parsed.data });
  return NextResponse.json({ account: view(account) });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.polymarketManagedAccount.updateMany({ where: { userId: session.user.id }, data: { liveEnabled: false, status: "PAUSED" } });
  return NextResponse.json({ paused: true });
}
