/**
 * Editor definitions for the canvas.
 *
 * Two sources feed the picker:
 *  1. This file's curated Polymarket + logic blocks (the ones that make a bot a
 *     *Polymarket* bot). The "Place order" block is self-sufficient: it carries
 *     the whole strategy (asset, timeframe, rule, stake, price cap and
 *     paper/live mode), so dropping it and saving publishes a real, executing
 *     KeeperHub workflow through the same pipeline the guided builder uses.
 *  2. KeeperHub's live catalog (see hosted-catalog.ts), for any other hosted
 *     action a user wants to compose alongside.
 *
 * Nodes are shaped as KeeperHub expects:
 *   trigger: { type: "trigger", data: { type: "trigger", config: { triggerType } } }
 *   action:  { type: "action",  data: { type: "action",  config: { integrationType, actionType, ...fields } } }
 */

export type FieldKind =
  | "text"
  | "number"
  | "textarea"
  | "select"
  | "boolean"
  | "cron";

export type FieldDef = {
  key: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  description?: string;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
  defaultValue?: string | number | boolean;
};

export type TriggerDef = {
  triggerType: "Manual" | "Schedule" | "Webhook";
  label: string;
  description: string;
  iconName: "Play" | "Clock" | "Webhook";
  fields: FieldDef[];
};

export type ActionDef = {
  /** key used in the picker — `${integrationType}/${actionType}` */
  id: string;
  integrationType: string;
  actionType: string;
  label: string;
  description: string;
  category: "polymarket" | "logic" | "io";
  fields: FieldDef[];
  /** Where this block comes from — Zircon-native canvas blocks vs. the hosted catalog. */
  source?: "zircon" | "keeperhub";
};

const ASSET_OPTIONS = [
  { label: "Bitcoin", value: "BTC" },
  { label: "Ethereum", value: "ETH" },
];

const TIMEFRAME_OPTIONS = [
  { label: "15 minutes", value: "15m" },
  { label: "1 hour", value: "1h" },
  { label: "4 hours", value: "4h" },
  { label: "1 day", value: "1d" },
];

export const TRIGGERS: TriggerDef[] = [
  {
    triggerType: "Manual",
    label: "Manual",
    description: "Run the bot when you click the trigger URL.",
    iconName: "Play",
    fields: [],
  },
  {
    triggerType: "Schedule",
    label: "Schedule",
    description: "Run on a cron schedule.",
    iconName: "Clock",
    fields: [
      {
        key: "scheduleCron",
        label: "Cron expression",
        kind: "cron",
        placeholder: "*/5 * * * *",
        description: "Standard 5-field cron (minute hour dom mon dow).",
        required: true,
        defaultValue: "*/5 * * * *",
      },
    ],
  },
  {
    triggerType: "Webhook",
    label: "Webhook",
    description: "POST to the bot's trigger URL to fire (e.g. a TradingView alert).",
    iconName: "Webhook",
    fields: [],
  },
];

export const ACTIONS: ActionDef[] = [
  // ── Polymarket ──────────────────────────────────────────────────────────
  {
    id: "zlabs-polymarket/read-signal",
    integrationType: "zlabs-polymarket",
    actionType: "read-signal",
    label: "Read signal",
    description:
      "Resolve the live Polymarket up/down market and evaluate the strategy rule against fresh candles.",
    category: "polymarket",
    source: "zircon",
    fields: [
      { key: "asset", label: "Asset", kind: "select", required: true, defaultValue: "BTC", options: ASSET_OPTIONS },
      {
        key: "timeframe",
        label: "Timeframe",
        kind: "select",
        required: true,
        defaultValue: "15m",
        description: "The bot resolves the active market slug at run time — no need to paste a slug.",
        options: TIMEFRAME_OPTIONS,
      },
      {
        key: "rule",
        label: "Rule",
        kind: "select",
        required: true,
        defaultValue: "momentum",
        description: "Evaluated server-side against live candles.",
        options: [
          { label: "Follow the trend", value: "momentum" },
          { label: "Bet against the last move", value: "reversal" },
          { label: "Moving-average crossover", value: "sma-cross" },
        ],
      },
    ],
  },
  {
    id: "zlabs-polymarket/place-order",
    integrationType: "zlabs-polymarket",
    actionType: "place-order",
    label: "Place order",
    description:
      "Trade the active Polymarket up/down market. Carries the full strategy — saving publishes a real KeeperHub workflow.",
    category: "polymarket",
    source: "zircon",
    fields: [
      { key: "asset", label: "Asset", kind: "select", required: true, defaultValue: "BTC", options: ASSET_OPTIONS },
      {
        key: "timeframe",
        label: "Timeframe",
        kind: "select",
        required: true,
        defaultValue: "15m",
        description: "Polymarket rotates these markets every window; the bot resolves the live slug each fire.",
        options: TIMEFRAME_OPTIONS,
      },
      {
        key: "rule",
        label: "Rule",
        kind: "select",
        required: true,
        defaultValue: "momentum",
        description: "How the direction is decided on a schedule. Ignored when a webhook alert names the direction.",
        options: [
          { label: "Follow the trend", value: "momentum" },
          { label: "Bet against the last move", value: "reversal" },
          { label: "Moving-average crossover", value: "sma-cross" },
        ],
      },
      {
        key: "stakeUsd",
        label: "Stake (USDC)",
        kind: "number",
        required: true,
        defaultValue: 10,
        description: "Dollar amount to spend per run (1–100).",
      },
      {
        key: "maxPrice",
        label: "Max price per share",
        kind: "number",
        defaultValue: 0.95,
        description: "Skip the run rather than buy above this price (0–1).",
      },
      {
        key: "mode",
        label: "Execution",
        kind: "select",
        required: true,
        defaultValue: "paper",
        description:
          "Practice records a simulated fill at the live order book — no money moves. Real money submits a signed order from your funded wallet, and is re-checked before every order.",
        options: [
          { label: "Practice (paper)", value: "paper" },
          { label: "Real money (live)", value: "live" },
        ],
      },
    ],
  },

  // ── Logic ──────────────────────────────────────────────────────────────
  {
    id: "logic/condition",
    integrationType: "logic",
    actionType: "condition",
    label: "Condition",
    description: "Branch on a boolean expression.",
    category: "logic",
    source: "zircon",
    fields: [
      {
        key: "expression",
        label: "Expression",
        kind: "text",
        placeholder: "input.signal === 'BUY'",
        required: true,
      },
    ],
  },
];

export function findAction(id: string): ActionDef | undefined {
  return ACTIONS.find((a) => a.id === id);
}

export function findActionByConfig(
  integrationType: string,
  actionType: string,
): ActionDef | undefined {
  return ACTIONS.find(
    (a) => a.integrationType === integrationType && a.actionType === actionType,
  );
}

export function findTrigger(
  triggerType: string,
): TriggerDef | undefined {
  return TRIGGERS.find((t) => t.triggerType === triggerType);
}
