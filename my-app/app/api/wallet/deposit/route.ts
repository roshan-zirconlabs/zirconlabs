import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bridgeRequest, depositInput, supportedAssets, walletAddress } from "@/lib/polymarket-bridge";

export async function GET(req: NextRequest) {
  try {
    const address = req.nextUrl.searchParams.get("address");
    if (!address) return NextResponse.json({ assets: await supportedAssets() });
    if (!walletAddress.safeParse(address).success) return NextResponse.json({ error: "Invalid bridge address" }, { status: 400 });
    return NextResponse.json(await bridgeRequest(`/status/${encodeURIComponent(address)}`));
  } catch { return NextResponse.json({ error: "Deposit data is unavailable. Retry shortly." }, { status: 502 }); }
}
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Sign in before creating deposit instructions." }, { status: 401 });
  const parsed = depositInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Confirm your Polymarket account wallet and choose a supported source asset." }, { status: 400 });
  try {
    const account = await prisma.polymarketManagedAccount.findUnique({ where: { userId: session.user.id }, select: { walletAddress: true } });
    if (!account?.walletAddress) return NextResponse.json({ error: "Create your trading account before requesting a deposit address." }, { status: 409 });
    const { chainId, tokenAddress } = parsed.data;
    const asset = (await supportedAssets()).find(a => a.chainId === chainId && a.token.address.toLowerCase() === tokenAddress.toLowerCase());
    if (!asset) return NextResponse.json({ error: "That token is no longer supported on this chain. Refresh the asset list." }, { status: 400 });
    const result = await bridgeRequest("/deposit", { address: account.walletAddress });
    const evm = walletAddress.parse(result.address?.evm);
    return NextResponse.json({ destination: account.walletAddress, depositAddress: evm, asset, createdAt: new Date().toISOString() });
  } catch { return NextResponse.json({ error: "The bridge did not return valid deposit instructions. No transfer was sent. Retry shortly." }, { status: 502 }); }
}
