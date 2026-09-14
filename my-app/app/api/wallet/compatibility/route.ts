import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, isAddress, formatUnits, erc20Abi } from "viem";
import { polygon } from "viem/chains";

// Source: https://docs.polymarket.com/resources/contracts (verified 2026-09-15).
const PUSD = "0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB";
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address || !isAddress(address) || /^0x0{40}$/i.test(address)) return NextResponse.json({ error: "Enter a non-zero Polymarket account wallet address." }, { status: 400 });
  const client = createPublicClient({ chain: polygon, transport: http(process.env.POLYGON_RPC_URL || "https://polygon-bor-rpc.publicnode.com", { timeout: 10000, retryCount: 1 }) });
  try {
    const chainId = await client.getChainId();
    if (chainId !== 137) throw new Error("Wrong RPC chain");
    const [balance, pol, code] = await Promise.all([
      client.readContract({ address: PUSD, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
      client.getBalance({ address }), client.getCode({ address }),
    ]);
    return NextResponse.json({ address, chainId, collateral: "pUSD", collateralAddress: PUSD,
      balance: formatUnits(balance, 6), polBalance: formatUnits(pol, 18),
      accountType: code && code !== "0x" ? "Contract account (type not verified)" : "EOA or undeployed account",
      checkedAt: new Date().toISOString(), canLiveTrade: false,
      recommendation: "Balance lookup only. This does not verify ownership, Polymarket account type, trading approvals, API authorization or geographic eligibility.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Polygon RPC lookup failed. Balances are unknown, not zero. Retry shortly." }, { status: 502 }); }
}
