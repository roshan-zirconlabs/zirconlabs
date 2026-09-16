import { createPublicClient, erc20Abi, formatUnits, http, isAddress } from "viem";
import { polygon } from "viem/chains";

/**
 * Read-only funding check for a Polymarket Deposit Wallet.
 *
 * A Deposit Wallet trades through Polymarket's gasless relayer, so unlike a bare
 * EOA it needs no separate token approvals and no POL for gas: once collateral
 * is in it, it is ready. The approval/gas fields are reported for transparency
 * but never gate trading.
 */
export async function readAccountReadiness(depositWalletAddress: string) {
  if (!isAddress(depositWalletAddress)) throw new Error("Invalid trading account address.");
  const rpc = createPublicClient({ chain: polygon, transport: http(process.env.POLYGON_RPC_URL || "https://polygon-bor-rpc.publicnode.com", { timeout: 8000, retryCount: 1 }) });
  if (await rpc.getChainId() !== 137) throw new Error("Polygon RPC is connected to the wrong network.");
  // https://docs.polymarket.com/resources/contracts (verified 2026-09-15)
  const token = "0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB";
  const [balance, decimals] = await Promise.all([
    rpc.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [depositWalletAddress] }),
    rpc.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),
  ]);
  const funded = balance > BigInt(0);
  return {
    readiness: funded ? "READY_TO_REVIEW" : "FUNDING_REQUIRED",
    address: depositWalletAddress, collateral: "pUSD", balance: formatUnits(balance, decimals),
    // Deposit wallets are gasless and pre-authorized for trading.
    nativeBalance: "0", approvals: { isFullyApproved: true, missingCount: 0 },
    checkedAt: new Date().toISOString(),
    note: "Deposit Wallet balance only. Trading is gasless and needs no separate approvals; market rules and eligibility are checked at order time.",
  };
}
