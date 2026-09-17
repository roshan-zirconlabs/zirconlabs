/**
 * Bridges the visual canvas and the strategy pipeline.
 *
 * A Polymarket bot is defined by its `StrategySpec` (asset, timeframe, rule,
 * stake, price cap, paper/live mode) — that single record is what
 * `/api/workflow/execute` reads and what `compileStrategyWorkflow` publishes.
 * These helpers let the canvas be a second front-end to that same record: the
 * "Place order" block carries the whole strategy, so the canvas can be built
 * from a spec and a spec can be read back from the canvas.
 *
 * Anything that isn't a Zircon Polymarket bot (a free-form graph of hosted
 * KeeperHub actions) is left untouched — `strategyFromCanvas` returns null and
 * the caller saves the raw graph as before.
 */
import { strategySpec, type StrategySpec } from "./strategy";

type Cfg = Record<string, unknown>;
type MinimalNode = { id: string; type?: string; data?: { type?: string; config?: Cfg } };

const PLACE_ORDER = { integration: "zlabs-polymarket", action: "place-order" };
const READ_SIGNAL = { integration: "zlabs-polymarket", action: "read-signal" };

function isBlock(n: MinimalNode, integration: string, action: string): boolean {
  const c = n.data?.config ?? {};
  return c.integrationType === integration && c.actionType === action;
}

/** The canvas "Place order" block, if present, is the whole strategy. */
export function strategyFromCanvas(nodes: MinimalNode[]): StrategySpec | null {
  const order = nodes.find((n) => isBlock(n, PLACE_ORDER.integration, PLACE_ORDER.action));
  if (!order) return null;
  const signal = nodes.find((n) => isBlock(n, READ_SIGNAL.integration, READ_SIGNAL.action));
  const trigger = nodes.find((n) => (n.data?.type ?? n.type) === "trigger");
  const oc = order.data?.config ?? {};
  const sc = signal?.data?.config ?? {};

  const source = trigger?.data?.config?.triggerType === "Webhook" ? "webhook" : "schedule";
  const num = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const candidate = {
    version: 1 as const,
    source,
    // The order block owns the strategy; a read-signal block, if present, is a
    // secondary place to have set asset/timeframe/rule, so it wins when set.
    asset: (sc.asset ?? oc.asset) as string,
    timeframe: (sc.timeframe ?? oc.timeframe) as string,
    rule: (sc.rule ?? oc.rule) as string,
    stakeUsd: num(oc.stakeUsd, 10),
    maxPrice: num(oc.maxPrice, 0.95),
    mode: (oc.mode === "live" ? "live" : "paper") as StrategySpec["mode"],
  };

  const parsed = strategySpec.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/** Builds the friendly canvas graph a Polymarket strategy is edited through. */
export function canvasFromStrategy(spec: StrategySpec): {
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
} {
  const triggerId = "trigger_strategy";
  const signalId = "action_signal";
  const orderId = "action_order";

  const triggerNode = {
    id: triggerId,
    type: "trigger",
    position: { x: 0, y: 0 },
    data: {
      type: "trigger",
      label: spec.source === "webhook" ? "Alert" : "Schedule",
      description:
        spec.source === "webhook"
          ? "Fires when an external alert (e.g. TradingView) POSTs to the bot URL."
          : "Runs on the market's cadence.",
      status: "idle",
      config: spec.source === "webhook" ? { triggerType: "Webhook" } : { triggerType: "Schedule" },
    },
  };

  const orderNode = {
    id: orderId,
    type: "action",
    position: { x: 640, y: 0 },
    data: {
      type: "action",
      label: "Place order",
      description: spec.mode === "live" ? "Real money · signed order from your wallet" : "Practice · simulated fill",
      status: "idle",
      config: {
        integrationType: "zlabs-polymarket",
        actionType: "place-order",
        asset: spec.asset,
        timeframe: spec.timeframe,
        rule: spec.rule,
        stakeUsd: spec.stakeUsd,
        maxPrice: spec.maxPrice,
        mode: spec.mode,
      },
    },
  };

  // A webhook bot takes its direction from the alert, so there is no rule step.
  if (spec.source === "webhook") {
    return {
      nodes: [triggerNode, orderNode],
      edges: [{ id: "edge_t_o", source: triggerId, target: orderId, type: "smoothstep" }],
    };
  }

  const signalNode = {
    id: signalId,
    type: "action",
    position: { x: 320, y: 0 },
    data: {
      type: "action",
      label: "Read signal",
      description: "Resolves the live market and evaluates the rule.",
      status: "idle",
      config: {
        integrationType: "zlabs-polymarket",
        actionType: "read-signal",
        asset: spec.asset,
        timeframe: spec.timeframe,
        rule: spec.rule,
      },
    },
  };

  return {
    nodes: [triggerNode, signalNode, orderNode],
    edges: [
      { id: "edge_t_s", source: triggerId, target: signalId, type: "smoothstep" },
      { id: "edge_s_o", source: signalId, target: orderId, type: "smoothstep" },
    ],
  };
}
