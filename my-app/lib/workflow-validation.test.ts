import test from "node:test";
import assert from "node:assert/strict";
import { getHostedSchemas, KeeperhubCatalogError, validateHostedGraph } from "./workflow-validation";

const schemas = { actions: { "web3/check-balance": { requiredFields: { address: "string", network: "string" } } }, triggers: { Manual: { requiredFields: {} } } };
const trigger = { id: "t", type: "trigger", data: { config: { triggerType: "Manual" } } };
test("unknown hosted actions cannot be published", () => {
  assert.throws(() => validateHostedGraph({ nodes: [trigger, { id: "a", type: "action", data: { config: { actionType: "zlabs-polymarket/place-order" } } }], edges: [{ id: "e", source: "t", target: "a" }] }, schemas), /not available/);
});
test("missing required fields cannot be published", () => {
  assert.throws(() => validateHostedGraph({ nodes: [trigger, { id: "a", type: "action", data: { config: { actionType: "web3/check-balance" } } }], edges: [{ id: "e", source: "t", target: "a" }] }, schemas), /address/);
});
test("disconnected actions are rejected", () => {
  assert.throws(() => validateHostedGraph({ nodes: [trigger, { id: "a", type: "action", data: { config: { actionType: "web3/check-balance", address: "0x123", network: "137" } } }], edges: [] }, schemas), /connected/);
});

test("catalog retries a transient upstream failure before succeeding", async () => {
  let attempts = 0;
  const result = await getHostedSchemas({
    retryDelayMs: 0,
    fetcher: async () => {
      attempts += 1;
      if (attempts === 1) return new Response("temporarily unavailable", { status: 503 });
      return new Response(JSON.stringify({ actions: {}, triggers: {} }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  assert.deepEqual(result, { actions: {}, triggers: {} });
  assert.equal(attempts, 2);
});

test("catalog failures expose a safe, actionable error code", async () => {
  await assert.rejects(
    () => getHostedSchemas({ retryDelayMs: 0, fetcher: async () => new Response("bad gateway", { status: 502 }) }),
    (error: unknown) => {
      assert.ok(error instanceof KeeperhubCatalogError);
      assert.equal(error.code, "KEEPERHUB_CATALOG_UNAVAILABLE");
      assert.equal(error.retryable, true);
      assert.match(error.message, /unavailable/i);
      return true;
    },
  );
});

test("invalid catalog payloads are not retried", async () => {
  let attempts = 0;
  await assert.rejects(
    () => getHostedSchemas({ retryDelayMs: 0, fetcher: async () => {
      attempts += 1;
      return new Response(JSON.stringify({ actions: {} }), { status: 200 });
    } }),
    (error: unknown) => {
      assert.ok(error instanceof KeeperhubCatalogError);
      assert.equal(error.code, "KEEPERHUB_CATALOG_INVALID");
      assert.equal(error.retryable, false);
      return true;
    },
  );
  assert.equal(attempts, 1);
});
