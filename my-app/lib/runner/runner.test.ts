import assert from "node:assert/strict";
import test from "node:test";
import { isWindowDue } from "./run";
import { alertActionFrom } from "./alert";
import { windowRequestId } from "./decide";

const at = (iso: string) => Math.floor(Date.parse(iso) / 1000);

test("a 15m window is due just after it opens and not once it is stale", () => {
  assert.equal(isWindowDue("15m", at("2026-10-21T11:30:05Z")), false, "waits for the candle to close");
  assert.equal(isWindowDue("15m", at("2026-10-21T11:30:20Z")), true);
  assert.equal(isWindowDue("15m", at("2026-10-21T11:35:10Z")), true);
  assert.equal(isWindowDue("15m", at("2026-10-21T11:40:00Z")), false, "a missed window is skipped, not traded late");
});

test("hourly windows wait five minutes for the closed candle", () => {
  assert.equal(isWindowDue("1h", at("2026-10-21T11:02:00Z")), false);
  assert.equal(isWindowDue("1h", at("2026-10-21T11:05:30Z")), true);
  assert.equal(isWindowDue("1h", at("2026-10-21T11:30:00Z")), false);
});

test("one request id per bot, market and window", () => {
  const a = windowRequestId("bot1", "btc-updown-15m-1", 10);
  assert.equal(a, windowRequestId("bot1", "btc-updown-15m-1", 10));
  assert.notEqual(a, windowRequestId("bot1", "btc-updown-15m-1", 11));
  assert.notEqual(a, windowRequestId("bot2", "btc-updown-15m-1", 10));
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("alert messages: plain text, TradingView JSON and nested strategy JSON", () => {
  assert.equal(alertActionFrom("buy"), "buy");
  assert.equal(alertActionFrom("  sell now please "), "sell");
  assert.equal(alertActionFrom('{"action":"buy","ticker":"BTCUSD"}'), "buy");
  assert.equal(alertActionFrom('{"side":"short"}'), "short");
  assert.equal(alertActionFrom('{"strategy":{"order":{"action":"sell"}}}'), "sell");
  assert.equal(alertActionFrom('{"ticker":"BTCUSD"}'), null);
  assert.equal(alertActionFrom(""), null);
});
