import dagre from "dagre";
import type { WorkflowEdge, WorkflowNode } from "./types";

const NODE_WIDTH = 250;
const NODE_HEIGHT = 110;
const H_GAP = 120; // Distance between horizontal steps
const V_GAP = 90;  // Distance between vertical branches

export function autoLayout(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): WorkflowNode[] {
  if (nodes.length === 0) return nodes;

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "LR",
    nodesep: V_GAP,
    ranksep: H_GAP,
    marginx: 40,
    marginy: 40,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of nodes) {
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  // Only add valid edges where both source and target exist in the nodes array
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const e of edges) {
    if (nodeIds.has(e.source) && nodeIds.has(e.target)) {
      g.setEdge(e.source, e.target);
    }
  }

  dagre.layout(g);

  // Position nodes based on dagre layout
  const positionedNodes = nodes.map((n) => {
    const pos = g.node(n.id);
    if (!pos) return n;
    return {
      ...n,
      position: {
        x: Math.round(pos.x - NODE_WIDTH / 2),
        y: Math.round(pos.y - NODE_HEIGHT / 2),
      },
    };
  });

  // Collision resolution pass: ensure no two nodes overlap in (x, y) space
  for (let i = 0; i < positionedNodes.length; i++) {
    for (let j = i + 1; j < positionedNodes.length; j++) {
      const a = positionedNodes[i];
      const b = positionedNodes[j];
      const dx = Math.abs(a.position.x - b.position.x);
      const dy = Math.abs(a.position.y - b.position.y);

      // If nodes overlap within bounding box (width 250, height 110)
      if (dx < NODE_WIDTH + 20 && dy < NODE_HEIGHT + 20) {
        // Shift node b downwards so they never collide
        b.position.y = a.position.y + NODE_HEIGHT + V_GAP;
      }
    }
  }

  return positionedNodes;
}
