import assert from "node:assert/strict";
import test from "node:test";
import { KeeperhubApiClient, executionOutcome, isTerminalStatus } from "./keeperhub-client.ts";

function client(fetcher: (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  return new KeeperhubApiClient({ baseUrl: "https://app.keeperhub.com", apiKey: "kh_test", fetcher });
}

test("executeWorkflow posts to KeeperHub's documented execution endpoint", async () => {
  let receivedUrl = "";
  let receivedInit: RequestInit | undefined;
  const result = await client(async (url, init) => {
    receivedUrl = String(url);
    receivedInit = init;
    return new Response(JSON.stringify({ executionId: "exec_123", status: "running" }), { status: 202 });
  }).executeWorkflow("workflow_123", { source: "zircon" });

  assert.equal(receivedUrl, "https://app.keeperhub.com/api/workflows/workflow_123/execute");
  assert.equal(receivedInit?.method, "POST");
  assert.equal((receivedInit?.headers as Record<string, string>).Authorization, "Bearer kh_test");
  assert.deepEqual(result, { executionId: "exec_123", status: "running" });
});

test("waitForExecution rejects a response without an execution status", async () => {
  await assert.rejects(
    () => client(async () => new Response(JSON.stringify({ executionId: "exec_123" }), { status: 200 })).waitForExecution("exec_123"),
    /missing execution status/i,
  );
});

test("every documented KeeperHub status is understood, not rejected", async () => {
  // KeeperHub reports lowercase statuses including `error` and `system_error`.
  // Rejecting an unrecognised one would report a failure for a settling run.
  for (const status of ["pending", "running", "unconfirmed", "success", "error", "system_error", "cancelled"]) {
    const execution = await client(async () =>
      new Response(JSON.stringify({ executionId: "e1", status }), { status: 200 }),
    ).waitForExecution("e1");
    assert.equal(execution.status, status);
  }
});

test("outcome and terminality follow KeeperHub's own semantics", () => {
  assert.equal(executionOutcome("error"), "FAILED");
  assert.equal(executionOutcome("system_error"), "FAILED");
  assert.equal(executionOutcome("success"), "SUCCESS");
  assert.equal(executionOutcome("cancelled"), "CANCELLED");
  // `unconfirmed` is still settling: reporting it as failed would be wrong.
  assert.equal(executionOutcome("unconfirmed"), "RUNNING");
  assert.equal(isTerminalStatus("unconfirmed"), false);
  assert.equal(isTerminalStatus("error"), true);
  // A status added after this client shipped must not be treated as terminal.
  assert.equal(executionOutcome("some_future_state"), "RUNNING");
  assert.equal(isTerminalStatus("some_future_state"), false);
});

test("the server's poll hint overrides the local terminal set", async () => {
  const execution = await client(async () =>
    new Response(JSON.stringify({ executionId: "e1", status: "a_new_terminal_state" }), {
      status: 200,
      headers: { "X-Poll-Interval-Hint": "0" },
    }),
  ).waitForExecution("e1");
  assert.equal(execution.terminal, true);
});
