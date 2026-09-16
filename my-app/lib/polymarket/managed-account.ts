import { isAddress } from "viem";

const PRIVY_API = "https://api.privy.io/v1";

export type ProvisionedWallet = { id: string; address: `0x${string}` };

export class ManagedWalletError extends Error {
  constructor(public code: string, message: string, public status = 503) {
    super(message);
    this.name = "ManagedWalletError";
  }
}

function config() {
  const appId = process.env.PRIVY_APP_ID?.trim();
  const appSecret = process.env.PRIVY_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    throw new ManagedWalletError("PROVIDER_NOT_CONFIGURED", "Managed trading accounts are not configured yet. Add PRIVY_APP_ID and PRIVY_APP_SECRET on the server.");
  }
  return { appId, authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString("base64")}` };
}

async function privy(path: string, init: RequestInit = {}) {
  const { appId, authorization } = config();
  const headers = new Headers(init.headers);
  headers.set("Authorization", authorization);
  headers.set("privy-app-id", appId);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${PRIVY_API}${path}`, { ...init, headers, cache: "no-store", signal: AbortSignal.timeout(15000) });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload && typeof payload === "object" && "error" in payload ? String((payload as { error?: unknown }).error) : "Wallet provider request failed.";
    throw new ManagedWalletError("PROVIDER_REQUEST_FAILED", detail, response.status >= 500 ? 502 : 400);
  }
  return payload as Record<string, unknown>;
}

export async function provisionManagedWallet(userId: string, email?: string | null): Promise<ProvisionedWallet> {
  if (!userId || !/^[a-zA-Z0-9_-]{1,64}$/.test(userId)) throw new ManagedWalletError("INVALID_USER", "Unable to provision a wallet for this account.", 400);
  const payload = await privy("/wallets", {
    method: "POST",
    headers: { "privy-idempotency-key": `zircon-polymarket-${userId}` },
    body: JSON.stringify({ chain_type: "ethereum", display_name: `Zircon trading · ${email || userId}`, external_id: `zircon_${userId}` }),
  });
  const id = typeof payload.id === "string" ? payload.id : "";
  const address = typeof payload.address === "string" ? payload.address : "";
  if (!id || !isAddress(address)) throw new ManagedWalletError("PROVIDER_INVALID_RESPONSE", "The wallet provider returned an invalid wallet. No account was saved.", 502);
  return { id, address: address as `0x${string}` };
}

export async function signTypedData(walletId: string, typedData: unknown): Promise<`0x${string}`> {
  const payload = await privy(`/wallets/${encodeURIComponent(walletId)}/rpc`, { method: "POST", body: JSON.stringify({ method: "eth_signTypedData_v4", params: { typed_data: typedData } }) });
  const signature = (payload.data as { signature?: unknown } | undefined)?.signature;
  if (typeof signature !== "string" || !/^0x[0-9a-f]+$/i.test(signature)) throw new ManagedWalletError("PROVIDER_INVALID_SIGNATURE", "The wallet provider did not return a valid signature.", 502);
  return signature as `0x${string}`;
}

export function managedWalletConfigured() { return Boolean(process.env.PRIVY_APP_ID?.trim() && process.env.PRIVY_APP_SECRET?.trim()); }

/**
 * Explicit launch gate for the signed Polymarket CLOB V2 adapter.
 *
 * The relayer credential is part of the gate, not an optional extra:
 * Polymarket rejects orders from a plain wallet, and the Deposit Wallet it
 * requires instead can only be created through their relayer. Without it a
 * live order fails at submission, after a budget reservation has been taken.
 */
export function liveExecutionConfigured() {
  const builder = Boolean(
    process.env.POLYMARKET_BUILDER_KEY?.trim() &&
    process.env.POLYMARKET_BUILDER_SECRET?.trim() &&
    process.env.POLYMARKET_BUILDER_PASSPHRASE?.trim(),
  );
  return managedWalletConfigured() && builder
    && process.env.POLYMARKET_CLOB_V2_ADAPTER_READY === "true"
    && process.env.POLYMARKET_LIVE_ENABLED === "true";
}
