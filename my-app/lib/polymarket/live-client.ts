import { createSecureClient, type SecureClient } from "@polymarket/client";
import { signerFrom } from "@polymarket/client/privy";
import { PrivyClient } from "@privy-io/node";
import { ManagedWalletError } from "@/lib/polymarket/managed-account";

/** Build the official Polymarket CLOB V2 client with a provider-held signer. */
export async function createManagedPolymarketClient(walletId: string, walletAddress: string): Promise<SecureClient> {
  const appId = process.env.PRIVY_APP_ID?.trim();
  const appSecret = process.env.PRIVY_APP_SECRET?.trim();
  if (!appId || !appSecret) throw new ManagedWalletError("PROVIDER_NOT_CONFIGURED", "Managed wallet credentials are not configured.");
  const privy = new PrivyClient({ appId, appSecret });
  const signer = signerFrom({ privy, walletId });
  return createSecureClient({ signer, wallet: walletAddress });
}
