import test from "node:test";
import assert from "node:assert/strict";
import { parseUnits } from "viem";
import { assertDestination, assertSameWithdrawal, resolveAmount, withdrawInput, WithdrawError } from "./withdraw.ts";

const OWN = "0xF1aDF32887aA2d9d5a2d3764435282d8A5654b0F";
const OTHER = "0xa858027a6DfAC0E99e3FfED2720dB10Ecea1F5AD";

test("a destination that could lose the funds is refused", () => {
  assert.throws(() => assertDestination("0x0000000000000000000000000000000000000000", OWN), WithdrawError);
  assert.throws(() => assertDestination("not-an-address", OWN), WithdrawError);
  assert.throws(() => assertDestination("0x123", OWN), WithdrawError);
  // Sending to itself would burn gas and move nothing.
  assert.throws(() => assertDestination(OWN.toLowerCase(), OWN), WithdrawError);
});

test("a valid destination is normalised to its checksummed form", () => {
  assert.equal(assertDestination(OTHER.toLowerCase(), OWN), OTHER);
  assert.equal(assertDestination(`  ${OTHER}  `, OWN), OTHER);
});

test("withdrawing more than the balance is refused rather than clamped", () => {
  assert.throws(() => resolveAmount(10, "4.787372"), WithdrawError);
  // Silently sending less than asked would be worse than refusing.
  assert.throws(() => resolveAmount(4.787373, "4.787372"), WithdrawError);
});

test("`all` empties the wallet exactly", () => {
  assert.equal(resolveAmount("all", "4.787372"), parseUnits("4.787372", 6));
  assert.throws(() => resolveAmount("all", "0"), WithdrawError);
});

test("an amount finer than the collateral's precision is refused", () => {
  assert.equal(resolveAmount(1.5, "4.787372"), parseUnits("1.5", 6));
  assert.equal(resolveAmount(0.000001, "4.787372"), parseUnits("0.000001", 6));
  assert.throws(() => resolveAmount(0.0000001, "4.787372"), WithdrawError);
  assert.throws(() => resolveAmount(-1 as number, "4.787372"), WithdrawError);
});

test("a withdrawal must be explicitly confirmed and carry a request reference", () => {
  const valid = { destination: OTHER, amount: 1, requestId: crypto.randomUUID(), confirm: true as const };
  assert.equal(withdrawInput.safeParse(valid).success, true);
  assert.equal(withdrawInput.safeParse({ ...valid, confirm: false }).success, false);
  assert.equal(withdrawInput.safeParse({ ...valid, requestId: "not-a-uuid" }).success, false);
  assert.equal(withdrawInput.safeParse({ ...valid, amount: 0 }).success, false);
  assert.equal(withdrawInput.safeParse({ ...valid, amount: "half" }).success, false);
  // Unknown fields are rejected so a stray key cannot change the terms.
  assert.equal(withdrawInput.safeParse({ ...valid, extra: 1 }).success, false);
});

test("replaying a request reference with different terms is refused", () => {
  const amount = parseUnits("1", 6);
  assert.doesNotThrow(() => assertSameWithdrawal({ destination: OTHER, amountUsd: 1 }, OTHER, amount));
  // Same reference, different destination: the classic replay-to-attacker case.
  assert.throws(() => assertSameWithdrawal({ destination: OTHER, amountUsd: 1 }, OWN, amount), WithdrawError);
  assert.throws(() => assertSameWithdrawal({ destination: OTHER, amountUsd: 2 }, OTHER, amount), WithdrawError);
});
