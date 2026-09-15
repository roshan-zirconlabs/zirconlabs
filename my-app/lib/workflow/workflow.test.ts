import test from "node:test";
import assert from "node:assert/strict";
import { botCallbackToken, verifyBotCallbackToken } from "./bot-token";
import { evaluateRule, strategySpec, type StrategySpec, type Candle } from "./strategy";
import { candidateSlugs } from "./active-market";
import { compileStrategyWorkflow, EXECUTE_NODE_ID } from "./compile";
import { validateHostedGraph, type HostedSchemas } from "../workflow-validation";

process.env.ZLABS_INGEST_SECRET ||= "test-secret-value-at-least-24-chars";
process.env.ZLABS_PUBLIC_URL ||= "https://example.test";

function spec(overrides: Partial<StrategySpec> = {}): StrategySpec {
  return strategySpec.parse({ asset: "BTC", timeframe: "15m", rule: "momentum", stakeUsd: 5, ...overrides });
}
const candle = (close: number, ts = 0): Candle => ({ ts, open: close, high: close, low: close, close });

test("a bot token authorises only its own bot", () => {
  const a = botCallbackToken("botaaa");
  assert.equal(verifyBotCallbackToken(a), "botaaa");
  // A token re-pointed at another bot must not verify.
  const forged = a.replace("botaaa", "botbbb");
  assert.equal(verifyBotCallbackToken(forged), null);
  assert.equal(verifyBotCallbackToken("zb1_botaaa_wrongdigest"), null);
  assert.equal(verifyBotCallbackToken(undefined), null);
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

test("the compiled workflow carries a bot-scoped token and never auto-retries an order", () => {
  const graph = compileStrategyWorkflow("botxyz", spec());
  const execute = graph.nodes.find(n => n.id === EXECUTE_NODE_ID);
  assert.ok(execute, "execute node exists");
  assert.equal(execute!.data.config.retryAttempts, 0, "a retried order could double-spend");
  const auth = String((execute!.data.config as { httpHeaders: string }).httpHeaders);
  assert.equal(verifyBotCallbackToken(JSON.parse(auth).Authorization.slice(7)), "botxyz");
  // The order step only runs on the Condition node's true branch.
  const edge = graph.edges.find(e => e.target === EXECUTE_NODE_ID);
  assert.equal(edge?.sourceHandle, "true");
});

test("the compiled workflow only uses actions the host actually publishes", () => {
  const schemas: HostedSchemas = {
    actions: {
      "HTTP Request": { requiredFields: { endpoint: "string", httpMethod: "string" } },
      Condition: { requiredFields: { condition: "string" } },
    },
    triggers: { Schedule: { requiredFields: { scheduleCron: "string" } } },
  };
  assert.doesNotThrow(() => validateHostedGraph(compileStrategyWorkflow("botxyz", spec()), schemas));
});

test("a live bot verifies its collateral on-chain through KeeperHub before trading", () => {
  const wallet = "0xF1aDF32887aA2d9d5a2d3764435282d8A5654b0F";
  const graph = compileStrategyWorkflow("botxyz", spec({ mode: "live" }), wallet);
  const balance = graph.nodes.find(n => n.id === "zlabs-balance");
  assert.ok(balance, "live bots read the balance on-chain");
  assert.equal(balance!.data.config.actionType, "web3/check-token-balance");
  assert.equal(balance!.data.config.network, "137", "Polymarket settles on Polygon");
  assert.equal(balance!.data.config.address, wallet);

  // The check runs before the signal, and the chain stays fully connected.
  const ids = new Set(graph.nodes.map(n => n.id));
  assert.ok(graph.edges.every(e => ids.has(e.source) && ids.has(e.target)));
  assert.ok(graph.edges.some(e => e.source === "zlabs-trigger" && e.target === "zlabs-balance"));
  assert.ok(graph.edges.some(e => e.source === "zlabs-balance" && e.target === "zlabs-signal"));

  // Practice bots move no money, so they do not need the on-chain read.
  assert.equal(compileStrategyWorkflow("botxyz", spec({ mode: "paper" }), wallet).nodes.find(n => n.id === "zlabs-balance"), undefined);
});
