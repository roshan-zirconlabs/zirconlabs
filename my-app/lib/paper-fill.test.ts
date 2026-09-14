import test from "node:test";
import assert from "node:assert/strict";
import { simulateBuy } from "./paper-fill";
test("paper buy consumes actual ask depth in price order", () => {
  const result = simulateBuy([{ price: "0.6", size: "10" }, { price: "0.5", size: "4" }], 5, 0.7);
  assert.equal(result.shares, 9);
  assert.equal(result.amount, 5);
  assert.equal(result.price, 5 / 9);
});
test("insufficient depth and price limits do not produce fabricated fills", () => {
  assert.throws(() => simulateBuy([{ price: "0.9", size: "1" }], 10, 0.8), /liquidity/);
});
test("invalid prices and amounts fail closed", () => {
  assert.throws(() => simulateBuy([{ price: "NaN", size: "2" }], 1, 1));
  assert.throws(() => simulateBuy([], -1, 1));
});
