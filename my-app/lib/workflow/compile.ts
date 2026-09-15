import { botCallbackToken } from "./bot-token";
import { CRON_FOR_TIMEFRAME, describeStrategy, type StrategySpec } from "./strategy";

/**
 * Compiles a strategy into a graph built only from actions KeeperHub actually
 * publishes: a Schedule trigger, two HTTP Request steps and a Condition.
 *
 * Zircon deliberately keeps the trading decision and the signing key on its own
 * side. KeeperHub orchestrates and owns the run record; the callbacks it makes
 * are authorised for a single bot and act on that bot owner's wallet only.
 */

export const BALANCE_NODE_ID = "zlabs-balance";
export const SIGNAL_NODE_ID = "zlabs-signal";
export const GATE_NODE_ID = "zlabs-gate";
export const EXECUTE_NODE_ID = "zlabs-execute";

const BALANCE_LABEL = "Check trading balance";
const SIGNAL_LABEL = "Read Polymarket signal";
const GATE_LABEL = "Trade this run?";
const EXECUTE_LABEL = "Place Polymarket order";

export function appBaseUrl(): string {
  const raw = process.env.ZLABS_PUBLIC_URL?.trim() || process.env.AUTH_URL?.trim() || process.env.NEXTAUTH_URL?.trim();
  if (!raw) throw new Error("Set ZLABS_PUBLIC_URL (or AUTH_URL) to this deployment's public HTTPS origin so KeeperHub can call back.");
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("The callback origin must use HTTPS.");
  }
  return url.origin;
}

type KhNode = {
  id: string;
  type: "trigger" | "action";
  position: { x: number; y: number };
  data: { label: string; description: string; type: "trigger" | "action"; config: Record<string, unknown>; status: "idle" };
};

type KhEdge = { id: string; source: string; target: string; sourceHandle?: string };

/** Polymarket's collateral on Polygon. https://docs.polymarket.com/resources/contracts */
const COLLATERAL_TOKEN = "0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB";
const POLYGON_CHAIN_ID = "137";

export function compileStrategyWorkflow(
  botId: string,
  spec: StrategySpec,
  tradingWalletAddress?: string | null,
): { nodes: KhNode[]; edges: KhEdge[] } {
  const base = appBaseUrl();
  const token = botCallbackToken(botId);
  const headers = JSON.stringify({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

  const triggerId = "zlabs-trigger";
  const nodes: KhNode[] = [
    {
      id: triggerId,
      type: "trigger",
      position: { x: 0, y: 0 },
      data: {
        label: "Schedule",
        description: describeStrategy(spec),
        type: "trigger",
        status: "idle",
        config: { triggerType: "Schedule", scheduleCron: CRON_FOR_TIMEFRAME[spec.timeframe], scheduleTimezone: "UTC" },
      },
    },
    {
      id: SIGNAL_NODE_ID,
      type: "action",
      position: { x: 320, y: 0 },
      data: {
        label: SIGNAL_LABEL,
        description: "Resolves the live market and evaluates the strategy rule.",
        type: "action",
        status: "idle",
        config: {
          actionType: "HTTP Request",
          endpoint: `${base}/api/workflow/signal`,
          httpMethod: "POST",
          httpHeaders: headers,
          httpBody: JSON.stringify({ botId }),
          timeout: 25,
          retryAttempts: 2,
          retryDelay: 2,
        },
      },
    },
    {
      id: GATE_NODE_ID,
      type: "action",
      position: { x: 640, y: 0 },
      data: {
        label: GATE_LABEL,
        description: "Only continues when the rule produced a tradable direction.",
        type: "action",
        status: "idle",
        config: { condition: `{{@${SIGNAL_NODE_ID}:${SIGNAL_LABEL}.data.trade}} === true`, actionType: "Condition" },
      },
    },
    {
      id: EXECUTE_NODE_ID,
      type: "action",
      position: { x: 960, y: 0 },
      data: {
        label: EXECUTE_LABEL,
        description: spec.mode === "live" ? "Submits a signed, price-capped order from your own wallet." : "Records a paper fill at the live order book.",
        type: "action",
        status: "idle",
        config: {
          actionType: "HTTP Request",
          endpoint: `${base}/api/workflow/execute`,
          httpMethod: "POST",
          httpHeaders: headers,
          httpBody: JSON.stringify({
            botId,
            direction: `{{@${SIGNAL_NODE_ID}:${SIGNAL_LABEL}.data.direction}}`,
            marketSlug: `{{@${SIGNAL_NODE_ID}:${SIGNAL_LABEL}.data.marketSlug}}`,
            requestId: `{{@${SIGNAL_NODE_ID}:${SIGNAL_LABEL}.data.requestId}}`,
          }),
          timeout: 30,
          // Never auto-retry an order submission: a retry can double-spend.
          retryAttempts: 0,
        },
      },
    },
  ];

  const edges: KhEdge[] = [
    { id: "zlabs-e1", source: triggerId, target: SIGNAL_NODE_ID },
    { id: "zlabs-e2", source: SIGNAL_NODE_ID, target: GATE_NODE_ID },
    { id: "zlabs-e3", source: GATE_NODE_ID, target: EXECUTE_NODE_ID, sourceHandle: "true" },
  ];

  // A live bot reads its own collateral balance on Polygon through KeeperHub
  // before it trades, so a run against an unfunded wallet fails in the run
  // record with an on-chain reason rather than at our API. KeeperHub verifies
  // the funding itself instead of taking Zircon's word for it.
  if (spec.mode === "live" && tradingWalletAddress) {
    nodes.splice(1, 0, {
      id: BALANCE_NODE_ID,
      type: "action",
      position: { x: 320, y: 180 },
      data: {
        label: BALANCE_LABEL,
        description: "Reads the bot owner's Polymarket collateral balance on Polygon.",
        type: "action",
        status: "idle",
        config: {
          actionType: "web3/check-token-balance",
          network: POLYGON_CHAIN_ID,
          address: tradingWalletAddress,
          tokenConfig: JSON.stringify({ mode: "custom", customToken: { address: COLLATERAL_TOKEN, symbol: "pUSD" } }),
        },
      },
    });
    edges[0] = { id: "zlabs-e1", source: triggerId, target: BALANCE_NODE_ID };
    edges.splice(1, 0, { id: "zlabs-e1b", source: BALANCE_NODE_ID, target: SIGNAL_NODE_ID });
  }

  return { nodes, edges };
}
