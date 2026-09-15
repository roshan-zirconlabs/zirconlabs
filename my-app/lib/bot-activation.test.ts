import assert from "node:assert/strict";
import test from "node:test";
import { activationAction } from "./bot-activation";

test("inactive drafts expose publish and activate instead of a run-only state", () => {
  assert.deepEqual(activationAction("INACTIVE", null), {
    active: true,
    label: "Publish & activate",
    description: "Save a valid workflow, publish it to KeeperHub, and enable its trigger.",
  });
});

test("active hosted workflows expose pause", () => {
  assert.deepEqual(activationAction("ACTIVE", "workflow_123"), {
    active: false,
    label: "Pause bot",
    description: "Disable the KeeperHub trigger without deleting the workflow.",
  });
});
