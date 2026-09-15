import test from "node:test";
import assert from "node:assert/strict";
import { resolveShares, simulateSell, sellInput, SellError } from "./sell.ts";

const bids = [{ price: "0.32", size: "100" }, { price: "0.30", size: "50" }, { price: "0.20", size: "500" }];

test("selling more than you hold is refused, not clamped", () => {
  assert.throws(() => resolveShares(10, 5.9, 5), SellError);
  assert.equal(resolveShares(5.9, 5.9, 5), 5.9);
});

test("`all` closes exactly the held amount", () => {
  assert.equal(resolveShares("all", 5.9, 5), 5.9);
  assert.throws(() => resolveShares("all", 0, 5), SellError);
});

test("a sell below the market's minimum order size is refused", () => {
  assert.throws(() => resolveShares(2, 5.9, 5), SellError);
  // Holding less than the minimum means the position cannot be closed here.
  assert.throws(() => resolveShares("all", 3, 5), SellError);
});

test("proceeds walk the bids from the best price down", () => {
  const fill = simulateSell(bids, 120, 0.2);
  // 100 @ 0.32 then 20 @ 0.30
  assert.equal(Number(fill.proceeds.toFixed(4)), 38);
  assert.equal(Number(fill.price.toFixed(6)), Number((38 / 120).toFixed(6)));
});

test("a price floor stops the sell rather than dumping into weak bids", () => {
  // Only 150 shares sit at or above 0.30; asking for 200 must fail.
  assert.throws(() => simulateSell(bids, 200, 0.3), SellError);
  assert.doesNotThrow(() => simulateSell(bids, 150, 0.3));
});

test("a sell must be explicitly confirmed and name a real position", () => {
  const valid = { assetId: "12345", shares: 5, minPrice: 0.3, requestId: crypto.randomUUID(), confirm: true as const };
  assert.equal(sellInput.safeParse(valid).success, true);
  assert.equal(sellInput.safeParse({ ...valid, confirm: false }).success, false);
  assert.equal(sellInput.safeParse({ ...valid, assetId: "not-a-token" }).success, false);
  assert.equal(sellInput.safeParse({ ...valid, minPrice: 1 }).success, false);
  assert.equal(sellInput.safeParse({ ...valid, shares: -1 }).success, false);
  assert.equal(sellInput.safeParse({ ...valid, extra: true }).success, false);
});
