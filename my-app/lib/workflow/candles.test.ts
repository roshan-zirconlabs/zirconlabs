import test from "node:test";
import assert from "node:assert/strict";
import { aggregateCandles, fetchCandles, CandleError, TIMEFRAME_SECONDS } from "./candles.ts";
import type { Candle } from "./strategy.ts";

const hour = 3600;
const bar = (ts: number, open: number, high: number, low: number, close: number): Candle => ({ ts, open, high, low, close });

test("four hourly bars combine into one 4h bar, keeping the extremes", () => {
  const base = Math.floor(1789488000 / TIMEFRAME_SECONDS["4h"]) * TIMEFRAME_SECONDS["4h"];
  const hourly = [
    bar(base, 100, 110, 95, 105),
    bar(base + hour, 105, 120, 104, 118),
    bar(base + 2 * hour, 118, 119, 90, 92),
    bar(base + 3 * hour, 92, 130, 91, 125),
  ];
  const [four] = aggregateCandles(hourly, hour, TIMEFRAME_SECONDS["4h"]);
  assert.equal(four.ts, base);
  assert.equal(four.open, 100, "opens at the first bar");
  assert.equal(four.close, 125, "closes at the last bar");
  assert.equal(four.high, 130);
  assert.equal(four.low, 90);
});

test("an incomplete group is dropped rather than reported as a full bar", () => {
  const base = Math.floor(1789488000 / TIMEFRAME_SECONDS["4h"]) * TIMEFRAME_SECONDS["4h"];
  assert.deepEqual(aggregateCandles([bar(base, 1, 2, 1, 2), bar(base + hour, 2, 3, 2, 3)], hour, TIMEFRAME_SECONDS["4h"]), []);
  // A mismatched or nonsensical ratio produces nothing at all.
  assert.deepEqual(aggregateCandles([bar(base, 1, 2, 1, 2)], hour, hour), []);
  assert.deepEqual(aggregateCandles([bar(base, 1, 2, 1, 2)], 900, hour + 1), []);
});

test("the chain moves past a provider that is blocked or empty", async () => {
  const calls: string[] = [];
  const blocked = { name: "blocked", fetch: async () => { calls.push("blocked"); return null; } };
  const empty = { name: "empty", fetch: async () => { calls.push("empty"); return []; } };
  const good = {
    name: "good",
    fetch: async () => { calls.push("good"); return [bar(1, 1, 1, 1, 1), bar(2, 2, 2, 2, 2)]; },
  };
  const out = await fetchCandles({ asset: "BTC", timeframe: "15m" }, 10, fetch, [blocked, empty, good]);
  assert.equal(out.length, 2);
  assert.deepEqual(calls, ["blocked", "empty", "good"], "tries each in order until one answers");
});

test("when every source fails the strategy gets no candles rather than bad ones", async () => {
  const dead = [{ name: "a", fetch: async () => null }, { name: "b", fetch: async () => null }];
  await assert.rejects(
    () => fetchCandles({ asset: "BTC", timeframe: "15m" }, 10, fetch, dead),
    (e: Error) => e instanceof CandleError && /tried a, b/.test(e.message),
  );
});

test("a single candle is not enough to evaluate anything", async () => {
  const thin = [{ name: "thin", fetch: async () => [bar(1, 1, 1, 1, 1)] }];
  await assert.rejects(() => fetchCandles({ asset: "BTC", timeframe: "15m" }, 10, fetch, thin), CandleError);
});
