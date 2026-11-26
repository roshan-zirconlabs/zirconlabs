import test from "node:test";
import assert from "node:assert/strict";
import { botHookToken, verifyBotHookToken } from "./bot-token";
import { evaluateRule, strategySpec, directionFromAlert, type StrategySpec, type Candle } from "./strategy";
import { candidateSlugs } from "./active-market";

process.env.BOT_SECRET ||= "test-secret-value-at-least-24-chars";

function spec(overrides: Partial<StrategySpec> = {}): StrategySpec {
  return strategySpec.parse({ asset: "BTC", timeframe: "15m", rule: "momentum", stakeUsd: 5, ...overrides });
}
const candle = (close: number, ts = 0): Candle => ({ ts, open: close, high: close, low: close, close });

test("an alert URL secret authorises only its own bot", () => {
  const a = botHookToken("botaaa");
  assert.equal(verifyBotHookToken("botaaa", a), true);
  assert.equal(verifyBotHookToken("botbbb", a), false, "a secret re-pointed at another bot must not verify");
  assert.equal(verifyBotHookToken("botaaa", "0".repeat(40)), false);
  assert.equal(verifyBotHookToken("botaaa", undefined), false);
});

test("rules that cannot decide return no direction instead of guessing", () => {
  assert.equal(evaluateRule(spec(), [candle(100)]).direction, null, "one candle is not enough");
  assert.equal(evaluateRule(spec(), [candle(100), candle(100)]).direction, null, "a flat close has no direction");
  assert.equal(
    evaluateRule(spec({ rule: "sma-cross", fastPeriod: 9, slowPeriod: 21 }), [candle(1), candle(2)]).direction,
    null,
    "not enough history for the slow average",
  );
});

test("momentum and reversal read the last closed candle in opposite directions", () => {
  const rising = [candle(100), candle(110)];
  assert.equal(evaluateRule(spec({ rule: "momentum" }), rising).direction, "UP");
  assert.equal(evaluateRule(spec({ rule: "reversal" }), rising).direction, "DOWN");
  const falling = [candle(110), candle(100)];
  assert.equal(evaluateRule(spec({ rule: "momentum" }), falling).direction, "DOWN");
  assert.equal(evaluateRule(spec({ rule: "reversal" }), falling).direction, "UP");
});

test("sma crossover follows the fast average", () => {
  const s = spec({ rule: "sma-cross", fastPeriod: 2, slowPeriod: 4 });
  // Rising series: the fast average sits above the slow one.
  assert.equal(evaluateRule(s, [candle(1), candle(2), candle(3), candle(10)]).direction, "UP");
  assert.equal(evaluateRule(s, [candle(10), candle(9), candle(3), candle(1)]).direction, "DOWN");
});

test("a slow period that is not slower than the fast period is rejected", () => {
  assert.equal(strategySpec.safeParse({ asset: "BTC", timeframe: "1h", rule: "sma-cross", stakeUsd: 5, fastPeriod: 20, slowPeriod: 10 }).success, false);
});

test("stake and price limits stay inside the tradable range", () => {
  assert.equal(strategySpec.safeParse({ asset: "BTC", timeframe: "1h", rule: "momentum", stakeUsd: 0 }).success, false);
  assert.equal(strategySpec.safeParse({ asset: "BTC", timeframe: "1h", rule: "momentum", stakeUsd: 5, maxPrice: 1 }).success, false);
});

test("candidate slugs match Polymarket's per-asset naming", () => {
  // 2026-09-15T05:45:00Z
  const ts = 1789465500;
  assert.deepEqual(candidateSlugs({ asset: "BTC", timeframe: "15m" }, ts)[0], `btc-updown-15m-${ts}`);
  assert.deepEqual(candidateSlugs({ asset: "ETH", timeframe: "15m" }, ts)[0], `eth-updown-15m-${ts}`);
  assert.match(candidateSlugs({ asset: "ETH", timeframe: "1d" }, ts)[0], /^ethereum-up-or-down-on-/);
  assert.match(candidateSlugs({ asset: "BTC", timeframe: "1h" }, ts)[0], /^bitcoin-up-or-down-.*-et$/);
});

test("an alert's wording maps to a direction, and ambiguity never trades", () => {
  for (const word of ["buy", "BUY", " long ", "up", "bullish"]) assert.equal(directionFromAlert(word), "UP", word);
  for (const word of ["sell", "short", "DOWN", "bearish"]) assert.equal(directionFromAlert(word), "DOWN", word);
  // An alert that does not name a direction must not be guessed at.
  for (const word of ["", "close", "flat", "exit", "maybe", "1", "{{strategy.order.action}}"]) {
    assert.equal(directionFromAlert(word), null, word);
  }
  assert.equal(directionFromAlert(undefined), null);
  assert.equal(directionFromAlert(42), null);
});

