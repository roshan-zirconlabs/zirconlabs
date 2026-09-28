import { createPublicClient, erc20Abi, formatUnits, http, isAddress } from "viem";
import { polygon } from "viem/chains";

/** Polymarket's collateral on Polygon (pUSD). https://docs.polymarket.com/resources/contracts */
export const COLLATERAL_TOKEN = "0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB" as const;
export const COLLATERAL_DECIMALS = 6;

let client: ReturnType<typeof createPublicClient> | null = null;
function rpc() {
  client ??= createPublicClient({
    chain: polygon,
    transport: http(process.env.POLYGON_RPC_URL || "https://polygon-bor-rpc.publicnode.com", { timeout: 8000, retryCount: 1 }),
  });
  return client;
}

/**
 * Spendable collateral in a Deposit Wallet, in dollars. A Deposit Wallet trades
 * gaslessly through Polymarket's relayer, so it needs no POL and no separate
 * token approvals — this balance is all that decides whether it can buy.
 */
export async function collateralBalance(address: string): Promise<{ usd: number; raw: string }> {
  if (!isAddress(address)) throw new Error("Invalid trading wallet address.");
  const units = await rpc().readContract({ address: COLLATERAL_TOKEN, abi: erc20Abi, functionName: "balanceOf", args: [address] });
  const raw = formatUnits(units, COLLATERAL_DECIMALS);
  return { usd: Number(raw), raw };
}
