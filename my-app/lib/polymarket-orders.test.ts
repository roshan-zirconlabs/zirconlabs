import test from "node:test";
import assert from "node:assert/strict";
import { assertBudget, assertSameRequest, orderInput } from "./polymarket-orders";

test("two individually small orders cannot exceed the cumulative daily limit", () => {
  assert.throws(() => assertBudget(10, 8, 3));
  assert.doesNotThrow(() => assertBudget(10, 8, 2));
  assert.throws(() => assertBudget(10, Number.NaN, 1));
});

test("reusing an idempotency key with a changed outcome or amount is rejected", () => {
  const existing = { marketSlug: "market", outcome: "Yes", amountUsd: 2, maxPrice: 0.5 };
  assert.doesNotThrow(() => assertSameRequest(existing, existing));
  assert.throws(() => assertSameRequest(existing, { ...existing, outcome: "No" }));
  assert.throws(() => assertSameRequest(existing, { ...existing, amountUsd: 3 }));
});

test("live submission requires a named outcome, a request key, price limit and confirmation", () => {
  const good = { marketSlug: "market", outcome: "Yes", amountUsd: 1, maxPrice: 0.5, requestId: "9b5a0921-7594-4427-bf29-f7b998d92cf2", confirm: true };
  assert.equal(orderInput.safeParse(good).success, true);
  assert.equal(orderInput.safeParse({ assetId: "111", amountUsd: 1, confirm: true }).success, false);
  assert.equal(orderInput.safeParse({ ...good, confirm: false }).success, false);
  assert.equal(orderInput.safeParse({ ...good, maxPrice: undefined }).success, false);
});
