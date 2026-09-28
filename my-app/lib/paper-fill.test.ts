import test from "node:test";
import assert from "node:assert/strict";
import { simulateBuy, simulateSell, takerFee, FillError } from "./paper-fill";

const crypto = { rate: 0.07, exponent: 1 };
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;

test("fee matches Polymarket's formula: 100 shares at 50¢ on a crypto market costs $1.75", () => {
  assert.ok(close(takerFee(100, 0.5, crypto), 1.75));
  assert.equal(takerFee(100, 0.5, null), 0);
});

test("a buy walks the book best-price first and never exceeds the all-in budget", () => {
  const asks = [{ price: 0.5, size: 4 }, { price: 0.6, size: 10 }];
  const fill = simulateBuy(asks, 5, 0.7, null);
  // 4 × 0.50 = $2, then $3 buys 5 shares at 0.60.
  assert.ok(close(fill.shares, 9));
  assert.ok(close(fill.usd, 5));
  assert.ok(close(fill.avgPrice, 5 / 9));
});

test("with fees, the same budget buys fewer shares and the total still equals the budget", () => {
  const asks = [{ price: 0.5, size: 1000 }];
  const fill = simulateBuy(asks, 10, 0.6, crypto);
  const unit = 0.5 + 0.07 * 0.25; // share + fee per share
  assert.ok(close(fill.shares, 10 / unit));
  assert.ok(close(fill.usd, 10));
  assert.ok(fill.feeUsd > 0);
});

test("a buy only fills what is offered within the price cap", () => {
  const fill = simulateBuy([{ price: 0.5, size: 2 }, { price: 0.9, size: 100 }], 50, 0.6, null);
  assert.ok(close(fill.shares, 2), "stops at the cap instead of paying 90¢");
  assert.throws(() => simulateBuy([{ price: 0.9, size: 100 }], 10, 0.6, null), FillError);
});

test("a sell takes the best bids first, stops at the floor, and nets out fees", () => {
  const bids = [{ price: 0.7, size: 5 }, { price: 0.6, size: 5 }, { price: 0.3, size: 100 }];
  const fill = simulateSell(bids, 20, 0.55, crypto);
  assert.ok(close(fill.shares, 10), "never sells below the 55¢ floor");
  const gross = 5 * 0.7 + 5 * 0.6;
  const fee = takerFee(5, 0.7, crypto) + takerFee(5, 0.6, crypto);
  assert.ok(close(fill.usd, gross - fee));
  assert.throws(() => simulateSell([{ price: 0.2, size: 10 }], 5, 0.5, null), FillError);
});

test("invalid inputs fail closed", () => {
  assert.throws(() => simulateBuy([], -1, 0.5, null), FillError);
  assert.throws(() => simulateBuy([], 10, 1, null), FillError);
  assert.throws(() => simulateSell([], 0, 0.5, null), FillError);
});
