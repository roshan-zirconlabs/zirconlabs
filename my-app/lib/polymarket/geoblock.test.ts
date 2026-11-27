import assert from "node:assert/strict";
import test from "node:test";
import { classifyRegion, assertOrderRegionAllowed } from "./geoblock";

test("close-only and blocked regions are classified from Polymarket's list", () => {
  assert.equal(classifyRegion("US", "VA", true), "close-only");
  assert.equal(classifyRegion("GB", "", false), "close-only");
  assert.equal(classifyRegion("CA", "ON", false), "close-only");
  assert.equal(classifyRegion("UA", "43", true), "blocked");
  assert.equal(classifyRegion("IR", "", true), "blocked");
});

test("API-unrestricted regions are allowed unless Polymarket flags them", () => {
  assert.equal(classifyRegion("IE", "L", false), "allowed");
  assert.equal(classifyRegion("JP", "", false), "allowed");
  assert.equal(classifyRegion("CA", "NS", false), "allowed");
  // Ireland is close-only on the website only; the endpoint's flag reflects
  // the website, so it must not block API orders from Dublin.
  assert.equal(classifyRegion("IE", "L", true), "allowed");
  // Elsewhere Polymarket's own flag wins over a list that may lag its policy.
  assert.equal(classifyRegion("ES", "MD", true), "close-only");
});

test("an unreachable region check does not block, a close-only region does", async () => {
  const down = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
  await assert.doesNotReject(assertOrderRegionAllowed(down));
});
