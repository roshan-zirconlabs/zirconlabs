import { prisma } from "@/lib/prisma";
import { fail, json, requireUserId, HttpError } from "@/lib/api";
import { bridgeRequest, depositNetworkSummary, walletAddress } from "@/lib/polymarket-bridge";
import { tradingDepositWallet } from "@/lib/polymarket/account";

const explorer: Record<string, string> = {
  "1": "https://etherscan.io/tx/", "137": "https://polygonscan.com/tx/", "42161": "https://arbiscan.io/tx/",
  "8453": "https://basescan.org/tx/", "10": "https://optimistic.etherscan.io/tx/",
};

/**
 * One deposit address for any supported token on any supported network —
 * Polymarket's bridge converts whatever arrives into trading collateral.
 */
export async function GET() {
  try {
    const userId = await requireUserId();
    const account = await prisma.tradingAccount.findUnique({ where: { userId } });
    if (!account) throw new HttpError("Create your trading wallet first.", 409);
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
          explorerUrl: typeof t.txHash === "string" && typeof t.chainId === "string" && explorer[t.chainId] ? explorer[t.chainId] + t.txHash : null,
        }))
      : [];
    return json({ depositAddress, networks, transfers });
  } catch (error) {
    if (error instanceof HttpError) return fail(error);
    return json({ error: "The deposit address is unavailable right now. Try again shortly." }, 502);
  }
}
