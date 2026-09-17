import test from "node:test";
import assert from "node:assert/strict";
import { walletAddress } from "./polymarket-bridge";

test("deposit destination rejects zero and malformed addresses", () => {
  assert.equal(walletAddress.safeParse("0x" + "0".repeat(40)).success, false);
  assert.equal(walletAddress.safeParse("0x1234").success, false);
  assert.equal(walletAddress.safeParse("0x" + "1".repeat(40)).success, true);
});
