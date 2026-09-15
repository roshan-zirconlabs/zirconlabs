import { createSecureClient, relayerApiKey, type SecureClient } from "@polymarket/client";
import { signerFrom } from "@polymarket/client/privy";
import { PrivyClient } from "@privy-io/node";
import { ManagedWalletError } from "@/lib/polymarket/managed-account";

/**
 * Builds a Polymarket CLOB client whose signing key is held by the wallet
 * provider.
 *
 * Polymarket refuses orders whose maker is a bare EOA ("maker address not
 * allowed, please use the deposit wallet flow"), so the account wallet must be
 * the signer's deterministic Deposit Wallet. The SDK derives that wallet when
 * `wallet` is omitted — passing the signer's own address would opt back into
 * the rejected EOA mode.
 *
 * Deploying a Deposit Wallet goes through Polymarket's relayer, which needs a
 * Relayer or Builder API key issued by Polymarket. Without one the SDK cannot
 * complete the flow, so live trading stays unavailable rather than failing at
 * order time.
 */
export function relayerConfigured(): boolean {
  return Boolean(process.env.POLYMARKET_RELAYER_API_KEY?.trim() && process.env.POLYMARKET_RELAYER_ADDRESS?.trim());
}

export async function createManagedPolymarketClient(walletId: string, _walletAddress: string): Promise<SecureClient> {
  const appId = process.env.PRIVY_APP_ID?.trim();
  const appSecret = process.env.PRIVY_APP_SECRET?.trim();
  if (!appId || !appSecret) throw new ManagedWalletError("PROVIDER_NOT_CONFIGURED", "Managed wallet credentials are not configured.");

  const key = process.env.POLYMARKET_RELAYER_API_KEY?.trim();
  const address = process.env.POLYMARKET_RELAYER_ADDRESS?.trim();
  if (!key || !address) {
    throw new ManagedWalletError(
      "RELAYER_NOT_CONFIGURED",
      "Live Polymarket trading needs a Polymarket Relayer or Builder API key. Polymarket rejects orders from a plain wallet, and the Deposit Wallet it requires can only be created through their relayer.",
      503,
    );
  }

  const privy = new PrivyClient({ appId, appSecret });
  const signer = signerFrom({ privy, walletId });
  // `wallet` is deliberately omitted: the SDK then uses the signer's
  // deterministic Deposit Wallet, which is the account type Polymarket accepts.
  return createSecureClient({ signer, apiKey: relayerApiKey({ key, address }) });
}
