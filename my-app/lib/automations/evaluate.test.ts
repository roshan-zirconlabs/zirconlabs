import test from "node:test";
import assert from "node:assert/strict";
import { exitConfig, entryConfig, webhookConfig } from "./config";
import { evaluateExit, evaluateEntry, alertAction } from "./evaluate";

const now = Date.UTC(2026, 8, 29, 12);
const exit = (c: object) => exitConfig.parse(c);

test("an exit needs at least one condition, and take-profit must sit above stop-loss", () => {
  assert.equal(exitConfig.safeParse({}).success, false);
  assert.equal(exitConfig.safeParse({ takeProfit: 0.4, stopLoss: 0.5 }).success, false);
  assert.equal(exitConfig.safeParse({ stopLoss: 0.3 }).success, true);
});

test("nothing fires while the price sits between stop-loss and take-profit", () => {
  const { decision, state } = evaluateExit(exit({ takeProfit: 0.8, stopLoss: 0.3 }), {}, 0.55, now, null);
  assert.equal(decision, null);
  assert.equal(state.peak, 0.55, "records the high for trailing stops");
});

test("take-profit sells, but never below the target minus slippage", () => {
  const { decision } = evaluateExit(exit({ takeProfit: 0.8, slippageCents: 3 }), {}, 0.83, now, null);
  assert.equal(decision?.trigger, "take-profit");
  assert.equal(decision?.limitPrice, 0.77);
});

test("stop-loss is priced off the current price so a gap down still gets out", () => {
  const { decision } = evaluateExit(exit({ stopLoss: 0.4, slippageCents: 3 }), {}, 0.2, now, null);
  assert.equal(decision?.trigger, "stop-loss");
  assert.equal(decision?.limitPrice, 0.17, "not 0.37, which would never fill at 20¢");
});

test("trailing stop follows the high and fires on the pullback", () => {
  const cfg = exit({ trailingCents: 10 });
  let s = evaluateExit(cfg, {}, 0.5, now, null).state;
  s = evaluateExit(cfg, s, 0.7, now, null).state;
  assert.equal(s.peak, 0.7);
  assert.equal(evaluateExit(cfg, s, 0.62, now, null).decision, null);
  assert.equal(evaluateExit(cfg, s, 0.6, now, null).decision?.trigger, "trailing-stop");
});

test("time exit fires inside the window before the market closes", () => {
  const cfg = exit({ exitHoursBeforeEnd: 2 });
  const end = new Date(now + 3 * 3_600_000);
  assert.equal(evaluateExit(cfg, {}, 0.5, now, end).decision, null);
  assert.equal(evaluateExit(cfg, {}, 0.5, now + 3_600_001, end).decision?.trigger, "time-exit");
});

test("stop-loss wins when several exits are true at once", () => {
  const cfg = exit({ stopLoss: 0.4, exitHoursBeforeEnd: 1 });
  const { decision } = evaluateExit(cfg, {}, 0.3, now, new Date(now));
  assert.equal(decision?.trigger, "stop-loss");
});

test("entries buy the dip or the breakout with a capped price", () => {
  const dip = entryConfig.parse({ amountUsd: 20, when: "below", price: 0.3 });
  assert.equal(evaluateEntry(dip, 0.35), null);
  assert.deepEqual(evaluateEntry(dip, 0.29)?.limitPrice, 0.32);
  const breakout = entryConfig.parse({ amountUsd: 20, when: "above", price: 0.6, slippageCents: 1 });
  assert.equal(evaluateEntry(breakout, 0.61)?.limitPrice, 0.62);
});

test("webhook defaults are safe", () => {
  const w = webhookConfig.parse({ amountUsd: 10 });
  assert.equal(w.maxPrice, 0.95);
  assert.equal(w.cooldownSeconds, 30);
});

test("alert wording maps to an action; anything ambiguous is refused", () => {
  assert.equal(alertAction("BUY"), "buy");
  assert.equal(alertAction("long"), "buy");
  assert.equal(alertAction("close"), "sell");
  assert.equal(alertAction("maybe"), null);
  assert.equal(alertAction(42), null);
});
