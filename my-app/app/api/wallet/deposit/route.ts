import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bridgeRequest, depositNetworkSummary, walletAddress } from "@/lib/polymarket-bridge";
import { tradingDepositWallet } from "@/lib/polymarket/account";

const explorer: Record<string, string> = {
  "1": "https://etherscan.io/tx/",
  "137": "https://polygonscan.com/tx/",
  "42161": "https://arbiscan.io/tx/",
  "8453": "https://basescan.org/tx/",
  "10": "https://optimistic.etherscan.io/tx/",
};

/**
 * One deposit address, shown immediately — there is no per-token or
 * per-network variant to choose between; the bridge converts whatever
 * arrives. Also returns recent transfers so a deposit isn't a black hole.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const account = await prisma.polymarketManagedAccount.findUnique({
    where: { userId: session.user.id },
    select: { id: true, providerWalletId: true, depositWalletAddress: true },
  });
  if (!account) return NextResponse.json({ error: "Create your trading account before requesting a deposit address." }, { status: 409 });

  try {
    const destination = await tradingDepositWallet(account);
    const [deposit, networks] = await Promise.all([
      bridgeRequest("/deposit", { address: destination }),
      depositNetworkSummary().catch(() => []),
    ]);
    const depositAddress = walletAddress.parse(deposit.address?.evm);

    const recent = await bridgeRequest(`/status/${encodeURIComponent(depositAddress)}`).catch(() => null);
    const transfers = Array.isArray(recent?.transactions)
      ? recent.transactions.slice(0, 5).map((t: Record<string, unknown>) => ({
          status: typeof t.status === "string" ? t.status : "pending",
          amountUsd: typeof t.amountUsd === "number" ? t.amountUsd : null,
          chainId: typeof t.chainId === "string" ? t.chainId : null,
          txHash: typeof t.txHash === "string" ? t.txHash : null,
          explorerUrl: typeof t.txHash === "string" && typeof t.chainId === "string" && explorer[t.chainId]
            ? explorer[t.chainId] + t.txHash
            : null,
        }))
      : [];

    return NextResponse.json({ destination, depositAddress, networks, transfers }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "The deposit address is unavailable right now. Retry shortly." }, { status: 502 });
  }
}
