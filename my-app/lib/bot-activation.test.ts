import assert from "node:assert/strict";
import test from "node:test";
import { activationAction } from "./bot-activation";

test("inactive bots expose activate", () => {
  const action = activationAction("INACTIVE");
  assert.equal(action.active, true);
  assert.equal(action.label, "Activate");
});

test("active bots expose pause", () => {
  const action = activationAction("ACTIVE");
  assert.equal(action.active, false);
  assert.equal(action.label, "Pause bot");
});
