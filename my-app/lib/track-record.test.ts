import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { computeTrackRecord } from "./track-record";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

// Every market resolves UP.
function resolvedUp() {
  globalThis.fetch = (async () => new Response(JSON.stringify({ closed: true, outcomes: '["Up","Down"]', outcomePrices: '["1","0"]', conditionId: "0xabc" }))) as typeof fetch;
}

function run(slug: string, direction: "UP" | "DOWN", paper?: boolean) {
  return {
    id: slug, startedAt: "2026-09-27T00:00:00Z", traded: true,
    output: { data: { marketSlug: slug, direction, amount: 10, shares: 20, ...(paper === undefined ? {} : { paper }) } },
  };
}

test("a record with no real orders is scored on paper and says so", async () => {
  resolvedUp();
  const record = await computeTrackRecord([run("m1", "UP"), run("m2", "DOWN", true)]);
  assert.equal(record.basis, "paper");
  assert.equal(record.liveTrades, 0);
  assert.equal(record.paperTrades, 2);
  assert.ok(record.proof.every((t) => t.paper));
});

test("real orders are scored on their own, never blended with practice fills", async () => {
  resolvedUp();
  const record = await computeTrackRecord([run("p1", "UP", true), run("p2", "UP", true), run("l1", "DOWN", false)]);
  assert.equal(record.basis, "live");
  assert.equal(record.trades, 1, "only the live order is scored");
  assert.equal(record.wins, 0);
  assert.equal(record.losses, 1);
  assert.equal(record.realizedPnlUsd, -10);
  assert.equal(record.paperTrades, 2);
  assert.ok(record.proof.every((t) => !t.paper));
});
