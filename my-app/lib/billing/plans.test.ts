import assert from "node:assert/strict";
import test from "node:test";
import { effectivePlan, extendPeriod, PERIOD_DAYS } from "./plans";

const now = new Date("2026-11-23T00:00:00Z");
const day = 24 * 60 * 60 * 1000;

test("a paid plan applies until its period ends, then falls back to FREE", () => {
  assert.equal(effectivePlan(null, now), "FREE");
  assert.equal(effectivePlan({ plan: "PRO", currentPeriodEnd: new Date(now.getTime() + day) }, now), "PRO");
  assert.equal(effectivePlan({ plan: "PRO", currentPeriodEnd: new Date(now.getTime() - 1) }, now), "FREE");
  assert.equal(effectivePlan({ plan: "PRO", currentPeriodEnd: null }, now), "FREE");
});

test("renewing early stacks onto the current period", () => {
  assert.equal(extendPeriod(null, now).getTime(), now.getTime() + PERIOD_DAYS * day);
  const end = new Date(now.getTime() + 5 * day);
  assert.equal(extendPeriod(end, now).getTime(), end.getTime() + PERIOD_DAYS * day);
  assert.equal(extendPeriod(new Date(now.getTime() - day), now).getTime(), now.getTime() + PERIOD_DAYS * day);
});
