import test from "node:test";
import assert from "node:assert/strict";
import { parseMarket, resolveMarketSelection } from "./polymarket-markets";

const market = { slug: "example-question", question: "Example question?", conditionId: "0x" + "1".repeat(64), outcomes: '["No","Yes"]', clobTokenIds: '["222","111"]', active: true, closed: false, acceptingOrders: true, enableOrderBook: true };
const json = (body: unknown) => new Response(JSON.stringify(body));

test("outcome mapping follows labels even when No appears before Yes", async () => {
  let url = "";
  const result = await resolveMarketSelection("example-question", "Yes", async input => { url = String(input); return json(market); });
  assert.equal(result.assetId, "111");
  assert.equal(url, "https://gamma-api.polymarket.com/markets/slug/example-question");
});

test("closed, incomplete and ambiguous markets cannot resolve a live order", async () => {
  for (const bad of [{ ...market, closed: true }, { ...market, acceptingOrders: false }, { ...market, clobTokenIds: '["222"]' }, { ...market, outcomes: '["Yes","Yes"]' }]) {
    await assert.rejects(() => resolveMarketSelection(market.slug, "Yes", async () => json(bad)));
  }
  await assert.rejects(() => resolveMarketSelection("../../positions", "Yes", async () => json(market)));
});

test("array-valued Up/Down outcomes preserve their actual token mapping", () => {
  const result = parseMarket({ ...market, outcomes: ["Down", "Up"], clobTokenIds: ["333", "444"] });
  assert.deepEqual(result.outcomes, [{ label: "Down", assetId: "333" }, { label: "Up", assetId: "444" }]);
});

test("market unavailable errors are not fabricated as an empty successful market", async () => {
  await assert.rejects(() => resolveMarketSelection(market.slug, "Yes", async () => new Response("", { status: 502 })));
});
