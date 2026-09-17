import { test } from "node:test";
import assert from "node:assert/strict";
import { canvasFromStrategy, strategyFromCanvas } from "./canvas-strategy";
import { strategySpec, type StrategySpec } from "./strategy";

function spec(overrides: Partial<StrategySpec> = {}): StrategySpec {
  return strategySpec.parse({ asset: "BTC", timeframe: "15m", rule: "momentum", stakeUsd: 10, ...overrides });
}

test("a scheduled strategy survives a canvas round trip", () => {
  const original = spec({ rule: "sma-cross", stakeUsd: 25, maxPrice: 0.8, mode: "live" });
  const canvas = canvasFromStrategy(original);
  // The scheduled shape carries a rule step plus the order.
  assert.equal(canvas.nodes.length, 3);
  const recovered = strategyFromCanvas(canvas.nodes as never);
  assert.deepEqual(recovered, original);
});

test("a webhook strategy drops the rule step but round-trips", () => {
  const original = spec({ source: "webhook", mode: "paper" });
  const canvas = canvasFromStrategy(original);
  assert.equal(canvas.nodes.length, 2); // trigger + order only
  const recovered = strategyFromCanvas(canvas.nodes as never);
  assert.equal(recovered?.source, "webhook");
  assert.equal(recovered?.mode, "paper");
});

test("mode defaults to paper unless the block explicitly says live", () => {
  const nodes = [
    { id: "t", type: "trigger", data: { type: "trigger", config: { triggerType: "Schedule" } } },
    { id: "o", type: "action", data: { type: "action", config: { integrationType: "zlabs-polymarket", actionType: "place-order", asset: "ETH", timeframe: "1h", rule: "momentum", stakeUsd: 10 } } },
  ];
  assert.equal(strategyFromCanvas(nodes as never)?.mode, "paper");
});

test("string number inputs from form fields are coerced", () => {
  const nodes = [
    { id: "t", type: "trigger", data: { type: "trigger", config: { triggerType: "Schedule" } } },
    { id: "o", type: "action", data: { type: "action", config: { integrationType: "zlabs-polymarket", actionType: "place-order", asset: "BTC", timeframe: "15m", rule: "momentum", stakeUsd: "20", maxPrice: "0.9" } } },
  ];
  const recovered = strategyFromCanvas(nodes as never);
  assert.equal(recovered?.stakeUsd, 20);
  assert.equal(recovered?.maxPrice, 0.9);
});

test("a free-form graph with no place-order block is not a strategy", () => {
  const nodes = [
    { id: "t", type: "trigger", data: { type: "trigger", config: { triggerType: "Manual" } } },
    { id: "a", type: "action", data: { type: "action", config: { integrationType: "http", actionType: "HTTP Request" } } },
  ];
  assert.equal(strategyFromCanvas(nodes as never), null);
});

test("an out-of-range stake makes the block invalid rather than silently clamped", () => {
  const nodes = [
    { id: "t", type: "trigger", data: { type: "trigger", config: { triggerType: "Schedule" } } },
    { id: "o", type: "action", data: { type: "action", config: { integrationType: "zlabs-polymarket", actionType: "place-order", asset: "BTC", timeframe: "15m", rule: "momentum", stakeUsd: 999 } } },
  ];
  assert.equal(strategyFromCanvas(nodes as never), null);
});
