/**
 * Mints an app-level Polymarket builder key.
 *
 * The current CLOB rejects bare-EOA makers and requires a Deposit Wallet, whose
 * creation goes through Polymarket's gasless relayer under a "builder" identity.
 * A builder key is self-serve — no Polymarket approval — and one app-level key
 * unlocks the deposit-wallet flow for every user.
 *
 * Run once:  npx tsx --env-file=.env scripts/mint-builder-key.ts
 * Then set POLYMARKET_BUILDER_KEY / _SECRET / _PASSPHRASE from the output.
 * The minting wallet is discarded — the builder credential is self-contained.
 */
import { ethers } from "ethers";
import { ClobClient } from "@polymarket/clob-client";

const HOST = process.env.POLYMARKET_HOST || "https://clob.polymarket.com";

async function main() {
  const wallet = ethers.Wallet.createRandom();
  const creds = await new ClobClient(HOST, 137, wallet as never).createOrDeriveApiKey();
  const bk = await new ClobClient(HOST, 137, wallet as never, creds).createBuilderApiKey();
  console.log("POLYMARKET_BUILDER_KEY=" + bk.key);
  console.log("POLYMARKET_BUILDER_SECRET=" + bk.secret);
  console.log("POLYMARKET_BUILDER_PASSPHRASE=" + bk.passphrase);
}

main().catch((e) => { console.error(e); process.exit(1); });
