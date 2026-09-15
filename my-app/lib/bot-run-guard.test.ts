import assert from "node:assert/strict";
import test from "node:test";
import { workflowRunGuard } from "./bot-run-guard";

test("unpublished bots explain how to become runnable", () => {
  assert.deepEqual(workflowRunGuard({ status: "INACTIVE", keeperhubWorkflowId: null }), {
    ok: false,
    error: "This bot is not published or active. Open the editor, save the workflow, then choose Publish & activate.",
  });
});

test("active hosted workflows are runnable", () => {
  assert.deepEqual(workflowRunGuard({ status: "ACTIVE", keeperhubWorkflowId: "workflow_123" }), { ok: true });
});
