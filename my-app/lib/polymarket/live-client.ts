import { createSecureClient, type SecureClient } from "@polymarket/client";
import { signerFrom } from "@polymarket/client/privy";
import { PrivyClient } from "@privy-io/node";
import { ManagedWalletError } from "@/lib/polymarket/managed-account";
import { builderAuthorization, builderKeyConfigured } from "@/lib/polymarket/builder-auth";

/**
 * Builds a Polymarket CLOB client for a user's provider-held wallet.
 *
 * Two things make this work on the current CLOB:
 *  - `wallet` is omitted, so the SDK uses the signer's deterministic Deposit
 *    Wallet as the account. Polymarket rejects a bare EOA maker; the Deposit
 *    Wallet is the account type it accepts.
 *  - an app builder key authorizes the request, which both lets the SDK deploy
 *    the Deposit Wallet gaslessly through Polymarket's relayer and passes the
 *    CLOB's builder check on order posting.
 *
 * The returned client's `account.wallet` is the user's Deposit Wallet address —
 * the address that holds funds and appears as the order maker.
 */
export async function createManagedPolymarketClient(walletId: string, _walletAddress?: string): Promise<SecureClient> {
  const appId = process.env.PRIVY_APP_ID?.trim();
  const appSecret = process.env.PRIVY_APP_SECRET?.trim();
  if (!appId || !appSecret) throw new ManagedWalletError("PROVIDER_NOT_CONFIGURED", "Managed wallet credentials are not configured.");
  if (!builderKeyConfigured()) {
    throw new ManagedWalletError(
      "BUILDER_KEY_NOT_CONFIGURED",
      "Live Polymarket trading needs an app builder key (POLYMARKET_BUILDER_KEY/SECRET/PASSPHRASE). Mint one with scripts/mint-builder-key.ts.",
      503,
    );
  }
  const privy = new PrivyClient({ appId, appSecret });
  const signer = signerFrom({ privy, walletId });
  return createSecureClient({ signer, apiKey: builderAuthorization() as never });
}

/** The Deposit Wallet address for a provider wallet — where funds must live. */
export async function resolveDepositWalletAddress(walletId: string): Promise<string> {
  const client = await createManagedPolymarketClient(walletId);
  const wallet = (client as unknown as { account?: { wallet?: string } }).account?.wallet;
  if (!wallet) throw new ManagedWalletError("DEPOSIT_WALLET_UNRESOLVED", "Could not resolve the trading deposit wallet.", 502);
  return wallet;
}
