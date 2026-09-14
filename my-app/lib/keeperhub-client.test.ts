import assert from "node:assert/strict";
import test from "node:test";
import { KeeperhubApiClient } from "./keeperhub-client.ts";

test("executeWorkflow posts to KeeperHub's documented execution endpoint", async () => {
  let receivedUrl = "";
  let receivedInit: RequestInit | undefined;
  const client = new KeeperhubApiClient({
    baseUrl: "https://app.keeperhub.com",
    apiKey: "kh_test",
    fetcher: async (url, init) => {
      receivedUrl = String(url);
      receivedInit = init;
      return new Response(JSON.stringify({ executionId: "exec_123", status: "running" }), { status: 202 });
    },
  });

  const result = await client.executeWorkflow("workflow_123", { source: "zircon" });

  assert.equal(receivedUrl, "https://app.keeperhub.com/api/workflows/workflow_123/execute");
  assert.equal(receivedInit?.method, "POST");
  assert.equal((receivedInit?.headers as Record<string, string>).Authorization, "Bearer kh_test");
  assert.deepEqual(result, { executionId: "exec_123", status: "RUNNING" });
});

test("waitForExecution rejects a response without an execution status", async () => {
  const client = new KeeperhubApiClient({
    baseUrl: "https://app.keeperhub.com",
    apiKey: "kh_test",
    fetcher: async () => new Response(JSON.stringify({ executionId: "exec_123" }), { status: 200 }),
  });

  await assert.rejects(() => client.waitForExecution("exec_123"), /missing execution status/i);
});
