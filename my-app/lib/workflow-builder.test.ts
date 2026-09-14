import assert from "node:assert/strict";
import test from "node:test";
import { autoLayout } from "../components/workflow/auto-layout.ts";
import {
  toKeeperhubGraph,
  fromKeeperhubGraph,
  ensureAddPlaceholders,
  seedEmptyGraph,
} from "../components/workflow/serialize.ts";
import type { WorkflowNode, WorkflowEdge } from "../components/workflow/types.ts";

test("autoLayout prevents node collision on branching workflows", () => {
  // A trigger branching to two actions simultaneously
  const nodes: WorkflowNode[] = [
    {
      id: "trigger-1",
      type: "trigger",
      position: { x: 0, y: 0 },
      data: { type: "trigger", label: "Webhook Trigger", config: { triggerType: "Webhook" } },
    },
    {
      id: "action-1",
      type: "action",
      position: { x: 0, y: 0 },
      data: {
        type: "action",
        label: "Check Bitstamp Price",
        config: { integrationType: "bitstamp", actionType: "get-ticker", asset: "BTC" },
      },
    },
    {
      id: "action-2",
      type: "action",
      position: { x: 0, y: 0 },
      data: {
        type: "action",
        label: "Place Polymarket YES Order",
        config: { integrationType: "polymarket", actionType: "place-order", side: "BUY", amount: 25 },
      },
    },
  ];

  const edges: WorkflowEdge[] = [
    { id: "e1", source: "trigger-1", target: "action-1" },
    { id: "e2", source: "trigger-1", target: "action-2" },
  ];

  const laidOut = autoLayout(nodes, edges);

  assert.equal(laidOut.length, 3);

  // Verify that action-1 and action-2 do NOT overlap
  const a1 = laidOut.find((n) => n.id === "action-1")!;
  const a2 = laidOut.find((n) => n.id === "action-2")!;

  const dx = Math.abs(a1.position.x - a2.position.x);
  const dy = Math.abs(a1.position.y - a2.position.y);

  // If they have similar x (same column/rank), their vertical distance must be >= 110px (node height)
  if (dx < 250) {
    assert.ok(
      dy >= 110,
      `Nodes action-1 and action-2 overlap vertically! dy=${dy}, expected >= 110`,
    );
  }
});

test("toKeeperhubGraph strips add placeholders and preserves action configs", () => {
  const nodes: WorkflowNode[] = [
    {
      id: "trig-1",
      type: "trigger",
      position: { x: 40, y: 40 },
      data: { type: "trigger", label: "Schedule Trigger", config: { triggerType: "Schedule", cron: "*/15 * * * *" } },
    },
    {
      id: "act-1",
      type: "action",
      position: { x: 410, y: 40 },
      data: {
        type: "action",
        label: "Polymarket Order",
        config: { integrationType: "polymarket", actionType: "place-order", asset: "BTC", timeframe: "15m", amount: 10 },
      },
    },
    {
      id: "add-placeholder",
      type: "add",
      position: { x: 780, y: 40 },
      data: { type: "add", label: "" },
    },
  ];

  const edges: WorkflowEdge[] = [
    { id: "e1", source: "trig-1", target: "act-1" },
    { id: "e2", source: "act-1", target: "add-placeholder" },
  ];

  const serialized = toKeeperhubGraph(nodes, edges);

  // Add node and its edge should be excluded from KeeperHub graph
  assert.equal(serialized.nodes.length, 2);
  assert.equal(serialized.edges.length, 1);
  assert.equal(serialized.nodes[1].id, "act-1");
  const actData = serialized.nodes[1].data as Record<string, unknown>;
  const actConfig = actData.config as Record<string, unknown>;
  assert.equal(actConfig.actionType, "place-order");
  assert.equal(actConfig.amount, 10);
});

test("fromKeeperhubGraph restores nodes and ignores unconfigured dummy actions", () => {
  const rawNodes = [
    {
      id: "t1",
      type: "trigger",
      position: { x: 0, y: 0 },
      data: { type: "trigger", label: "Manual Trigger", config: { triggerType: "Manual" } },
    },
    {
      id: "unconfigured-dummy",
      type: "action",
      position: { x: 100, y: 100 },
      data: { type: "action", label: "Unset", config: {} }, // Missing integrationType and actionType
    },
    {
      id: "valid-action",
      type: "action",
      position: { x: 200, y: 200 },
      data: {
        type: "action",
        label: "Active Market Order",
        config: { integrationType: "polymarket", actionType: "place-order", side: "BUY" },
      },
    },
  ];

  const rawEdges = [
    { id: "e1", source: "t1", target: "unconfigured-dummy" },
    { id: "e2", source: "t1", target: "valid-action" },
  ];

  const restored = fromKeeperhubGraph(rawNodes, rawEdges);

  assert.equal(restored.nodes.length, 2); // unconfigured dummy should be dropped
  assert.equal(restored.edges.length, 1);
  assert.equal(restored.edges[0].target, "valid-action");
});

test("ensureAddPlaceholders adds an interactive add node to leaf action nodes", () => {
  const seeded = seedEmptyGraph();
  assert.equal(seeded.nodes.length, 2);
  assert.equal(seeded.nodes[0].type, "trigger");
  assert.equal(seeded.nodes[1].type, "add");

  // Chain without add nodes
  const nodes: WorkflowNode[] = [
    {
      id: "trig",
      type: "trigger",
      position: { x: 0, y: 0 },
      data: { type: "trigger", label: "Start", config: { triggerType: "Manual" } },
    },
    {
      id: "step1",
      type: "action",
      position: { x: 200, y: 0 },
      data: {
        type: "action",
        label: "Execute Trade",
        config: { integrationType: "polymarket", actionType: "place-order" },
      },
    },
  ];
  const edges: WorkflowEdge[] = [{ id: "e1", source: "trig", target: "step1" }];

  const withAdds = ensureAddPlaceholders(nodes, edges);

  assert.equal(withAdds.nodes.length, 3);
  const addNode = withAdds.nodes.find((n) => n.type === "add");
  assert.ok(addNode, "Add node should be appended after leaf action");
  const addEdge = withAdds.edges.find((e) => e.target === addNode?.id);
  assert.equal(addEdge?.source, "step1");
});
