import { z } from "zod";
import { isAddress } from "viem";

export const walletAddress = z.string().refine(v => isAddress(v) && !/^0x0{40}$/i.test(v), "Invalid account wallet address");
export const assetSchema = z.object({ chainId: z.string(), chainName: z.string(), token: z.object({ name: z.string(), symbol: z.string(), address: z.string(), decimals: z.number().int().min(0).max(36) }), minCheckoutUsd: z.number().nonnegative() });
export type BridgeAsset = z.infer<typeof assetSchema>;
export const depositInput = z.object({ confirmedAccountWallet: z.literal(true), chainId: z.enum(["1", "137", "42161", "8453", "10"]), tokenAddress: z.string().min(1).max(100) });

export async function bridgeRequest(path: string, body?: unknown) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (/^0x[a-fA-F0-9]{64}$/.test(process.env.POLYMARKET_BUILDER_CODE ?? "")) headers["X-Builder-Code"] = process.env.POLYMARKET_BUILDER_CODE!;
  const res = await fetch(`https://bridge.polymarket.com${path}`, { method: body ? "POST" : "GET", body: body ? JSON.stringify(body) : undefined, headers, signal: AbortSignal.timeout(15000), cache: "no-store" });
  if (!res.ok) throw new Error(`Polymarket bridge request failed (${res.status}). No transfer was sent.`);
  return res.json();
}
export async function supportedAssets() {
  const data = await bridgeRequest("/supported-assets");
  return z.array(assetSchema).parse(data.supportedAssets).filter(a => ["1", "137", "42161", "8453", "10"].includes(a.chainId));
}
