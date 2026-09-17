/**
 * Editor definitions. Triggers are the three KeeperHub trigger types; actions
 * come only from KeeperHub's live catalog (see hosted-catalog.ts), so anything a
 * user can add to the canvas is something KeeperHub can actually run.
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
  id: string;
  integrationType: string;
  actionType: string;
  label: string;
  description: string;
  category: "logic" | "io";
  fields: FieldDef[];
};

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
    description: "POST to the bot's trigger URL to fire.",
    iconName: "Webhook",
    fields: [],
  },
];

export function findTrigger(
  triggerType: string,
): TriggerDef | undefined {
  return TRIGGERS.find((t) => t.triggerType === triggerType);
}
