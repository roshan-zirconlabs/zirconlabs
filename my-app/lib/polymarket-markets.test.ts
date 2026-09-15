import test from "node:test";
import assert from "node:assert/strict";
import { parseMarket, resolveMarketSelection, previewBuy } from "./polymarket-markets";

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

test("buy preview checks share minimums rather than comparing minimum shares to dollars", async () => {
  const fetcher: typeof fetch = async input => String(input).includes("gamma-api") ? json(market) : json({ asset_id: "111", min_order_size: "5", tick_size: "0.01", asks: [{ price: "0.20", size: "20" }] });
  const result = await previewBuy({ marketSlug: market.slug, outcome: "Yes", amountUsd: 1, maxPrice: 0.2 }, fetcher);
  assert.equal(result.estimatedShares, 5);
  assert.equal(result.minimumShares, 5);
  await assert.rejects(() => previewBuy({ marketSlug: market.slug, outcome: "Yes", amountUsd: 1, maxPrice: 0.19 }, fetcher));
});

test("wrong-token books and insufficient liquidity fail closed", async () => {
  for (const book of [{ asset_id: "222", asks: [{ price: "0.2", size: "10" }] }, { asset_id: "111", asks: [{ price: "0.2", size: "1" }] }]) {
    await assert.rejects(() => previewBuy({ marketSlug: market.slug, outcome: "Yes", amountUsd: 1, maxPrice: 0.2 }, async input => String(input).includes("gamma-api") ? json(market) : json({ min_order_size: "5", tick_size: "0.01", ...book })));
  }
});
