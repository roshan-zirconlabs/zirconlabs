import "server-only";
import { BuilderSigner } from "@polymarket/builder-signing-sdk";

/**
 * App-level builder authorization for the Polymarket CLOB.
 *
 * Polymarket no longer accepts orders from a bare EOA maker: every account must
 * trade through a Deposit Wallet, and creating one goes through Polymarket's
 * gasless relayer, which authenticates the caller as a "builder". A builder key
 * is self-minted (clob-client `createBuilderApiKey`) and needs no approval from
 * Polymarket, so one app-level key unlocks the deposit-wallet flow for every
 * user — each user still signs with, and funds, their own wallet.
 */

/** Minimal shape the SDK's `apiKey` option requires; avoids importing internals. */
export type BuilderAuthorization = {
  readonly isBuilderKey: boolean;
  readonly supportGasless: boolean;
  authorize(request: { method: string; path: string; body?: string }): Promise<Record<string, string>>;
};

export function builderKeyConfigured(): boolean {
  return Boolean(
    process.env.POLYMARKET_BUILDER_KEY?.trim() &&
    process.env.POLYMARKET_BUILDER_SECRET?.trim() &&
    process.env.POLYMARKET_BUILDER_PASSPHRASE?.trim(),
  );
}

export function builderAuthorization(): BuilderAuthorization {
  const key = process.env.POLYMARKET_BUILDER_KEY?.trim();
  const secret = process.env.POLYMARKET_BUILDER_SECRET?.trim();
  const passphrase = process.env.POLYMARKET_BUILDER_PASSPHRASE?.trim();
  if (!key || !secret || !passphrase) {
    throw new Error("Polymarket builder key is not configured (POLYMARKET_BUILDER_KEY/SECRET/PASSPHRASE).");
  }
  const signer = new BuilderSigner({ key, secret, passphrase });
  return {
    isBuilderKey: true,
    supportGasless: true,
    async authorize(request) {
      // Each request is signed fresh: the CLOB checks the HMAC over method,
      // path and body against the builder secret.
      return signer.createBuilderHeaderPayload(request.method, request.path, request.body) as unknown as Record<string, string>;
    },
  };
}
