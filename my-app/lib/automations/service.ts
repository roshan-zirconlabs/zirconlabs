import "server-only";
import crypto from "crypto";
import type { Automation, AutomationKind, TradingMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { resolveOutcome, MarketError } from "@/lib/polymarket/markets";
import { getMidpoints } from "@/lib/polymarket/prices";
import { heldShares } from "@/lib/trading/portfolio";
import { entryConfig, exitConfig, webhookConfig } from "./config";
import { cents } from "./evaluate";

export class AutomationError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "AutomationError";
  }
}

const MAX_ACTIVE = 50;

export function hashSecret(secret: string) {
  return crypto.createHash("sha256").update(secret, "utf8").digest("hex");
}

export function describeAutomation(a: Pick<Automation, "kind" | "config" | "outcome">): string {
  const c = a.config as Record<string, unknown>;
  if (a.kind === "EXIT") {
    const parts: string[] = [];
    if (typeof c.takeProfit === "number") parts.push(`take profit at ${cents(c.takeProfit)}`);
    if (typeof c.stopLoss === "number") parts.push(`stop loss at ${cents(c.stopLoss)}`);
    if (typeof c.trailingCents === "number") parts.push(`trailing stop ${c.trailingCents}¢`);
    if (typeof c.exitHoursBeforeEnd === "number") parts.push(`exit ${c.exitHoursBeforeEnd}h before close`);
    const pct = typeof c.sellPercent === "number" && c.sellPercent < 100 ? `${c.sellPercent}% of ` : "";
    return `Sell ${pct}${a.outcome}: ${parts.join(", ")}`;
  }
  if (a.kind === "ENTRY") {
    return `Buy $${c.amountUsd} of ${a.outcome} when the price ${c.when === "below" ? "drops to" : "rises to"} ${cents(Number(c.price))}`;
  }
  return `TradingView alert: buy $${c.amountUsd} of ${a.outcome} (max ${cents(Number(c.maxPrice))}), sell on close`;
}

export type CreateInput = {
  userId: string;
  mode: TradingMode;
  kind: AutomationKind;
  marketSlug: string;
  outcome: string;
  config: unknown;
};

/** Returns the automation, and for webhooks the one-time secret for its URL. */
export async function createAutomation(input: CreateInput): Promise<{ automation: Automation; secret?: string }> {
  const active = await prisma.automation.count({ where: { userId: input.userId, status: "ACTIVE" } });
  if (active >= MAX_ACTIVE) throw new AutomationError(`You can have up to ${MAX_ACTIVE} active automations.`, 409);

  let resolved;
  try {
    resolved = await resolveOutcome(input.marketSlug, input.outcome);
  } catch (error) {
    throw new AutomationError(error instanceof MarketError ? error.message : "That market couldn't be loaded.", 502);
  }
  const { market, outcome } = resolved;
  if (!market.tradable) throw new AutomationError("This market isn't accepting orders, so nothing can run on it.", 409);

  const schema = input.kind === "EXIT" ? exitConfig : input.kind === "ENTRY" ? entryConfig : webhookConfig;
  const parsed = schema.safeParse(input.config);
  if (!parsed.success) throw new AutomationError(parsed.error.issues[0]?.message ?? "Check the automation settings.");

  if (input.kind === "EXIT") {
    const shares = await heldShares(input.userId, input.mode, outcome.tokenId).catch(() => 0);
    if (shares <= 1e-6) throw new AutomationError(`You don't hold ${outcome.label} on this market${input.mode === "PAPER" ? " in practice mode" : ""}. Buy first, then protect it.`, 409);
  }
  if (input.kind === "ENTRY") {
    const mid = (await getMidpoints([outcome.tokenId]).catch(() => new Map<string, number>())).get(outcome.tokenId);
    const c = parsed.data as { when: "below" | "above"; price: number };
    if (mid !== undefined && ((c.when === "below" && mid <= c.price) || (c.when === "above" && mid >= c.price))) {
      throw new AutomationError(`The price is already ${cents(mid)}, so this would buy immediately. Use Buy now instead, or pick a different level.`, 409);
    }
  }

  const secret = input.kind === "WEBHOOK" ? crypto.randomBytes(24).toString("base64url") : undefined;
  const automation = await prisma.automation.create({
    data: {
      userId: input.userId, mode: input.mode, kind: input.kind,
      tokenId: outcome.tokenId, conditionId: market.conditionId, marketSlug: market.slug,
      question: market.question, outcome: outcome.label, endDate: market.endDate ? new Date(market.endDate) : null,
      config: parsed.data, webhookSecretHash: secret ? hashSecret(secret) : null,
    },
  });
  await logActivity({
    userId: input.userId, automationId: automation.id, mode: input.mode,
    title: `Automation created: ${describeAutomation(automation)}`, detail: market.question,
  });
  return { automation, secret };
}

/** A fresh secret for a webhook automation; the old URL stops working. */
export async function rotateWebhookSecret(userId: string, id: string) {
  const automation = await prisma.automation.findFirst({ where: { id, userId, kind: "WEBHOOK" } });
  if (!automation) throw new AutomationError("Webhook automation not found.", 404);
  const secret = crypto.randomBytes(24).toString("base64url");
  await prisma.automation.update({ where: { id }, data: { webhookSecretHash: hashSecret(secret) } });
  return secret;
}
