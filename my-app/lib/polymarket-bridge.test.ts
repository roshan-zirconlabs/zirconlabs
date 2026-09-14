import test from "node:test";
import assert from "node:assert/strict";
import { depositInput, walletAddress } from "./polymarket-bridge";
test("deposit destination rejects zero addresses and unconfirmed destinations", () => {
  assert.equal(walletAddress.safeParse("0x" + "0".repeat(40)).success, false);
  assert.equal(depositInput.safeParse({ address: "0x" + "1".repeat(40), chainId: "137", tokenAddress: "0x" + "2".repeat(40) }).success, false);
});
