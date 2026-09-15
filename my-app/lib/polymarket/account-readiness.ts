import { createPublicClient as createPolymarketClient } from "@polymarket/client";
import { createPublicClient, erc20Abi, formatUnits, http, isAddress } from "viem";
import { polygon } from "viem/chains";

/** Read-only checks: do not create API credentials or request wallet signatures. */
export async function readAccountReadiness(address: string) {
  if (!isAddress(address)) throw new Error("Invalid trading account address.");
  const rpc = createPublicClient({ chain: polygon, transport: http(process.env.POLYGON_RPC_URL || "https://polygon-bor-rpc.publicnode.com", { timeout: 8000, retryCount: 1 }) });
  if (await rpc.getChainId() !== 137) throw new Error("Polygon RPC is connected to the wrong network.");
  // https://docs.polymarket.com/resources/contracts (verified 2026-09-15)
  const token = "0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB";
  const [balance, decimals, nativeBalance, approvals] = await Promise.all([
    rpc.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
    rpc.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),
    rpc.getBalance({ address }),
    createPolymarketClient().fetchTradingApprovalsState({ user: address }),
  ]);
  return {
    readiness: balance === BigInt(0) ? "FUNDING_REQUIRED" : !approvals.isFullyApproved ? "APPROVALS_REQUIRED" : "READY_TO_REVIEW",
    address, collateral: "pUSD", balance: formatUnits(balance, decimals), nativeBalance: formatUnits(nativeBalance, 18),
    approvals: { isFullyApproved: approvals.isFullyApproved, missingCount: approvals.missing.erc20.length + approvals.missing.erc1155.length },
    checkedAt: new Date().toISOString(),
    note: "On-chain balance and approvals only. Order authorization, fees, market limits and regional eligibility are checked separately.",
  };
}
