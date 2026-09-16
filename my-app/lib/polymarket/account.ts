import "server-only";
import { prisma } from "@/lib/prisma";
import { resolveDepositWalletAddress } from "@/lib/polymarket/live-client";

type AccountRow = { id: string; providerWalletId: string; depositWalletAddress: string | null };

/**
 * The user's Polymarket Deposit Wallet — where collateral lives and the address
 * that acts as the order maker. Derived once from the signer and cached, since
 * resolving it builds a secure client.
 */
export async function tradingDepositWallet(account: AccountRow): Promise<string> {
  if (account.depositWalletAddress) return account.depositWalletAddress;
  const depositWallet = await resolveDepositWalletAddress(account.providerWalletId);
  await prisma.polymarketManagedAccount.update({
    where: { id: account.id },
    data: { depositWalletAddress: depositWallet },
  }).catch(() => { /* A concurrent resolve may have set it; the value is deterministic. */ });
  return depositWallet;
}
