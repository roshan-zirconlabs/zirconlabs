import { z } from "zod";

/**
 * What a user can ask an automation to do, per kind. Prices are probabilities
 * in dollars per share (0.42 = 42¢). Every field maps to something the engine
 * actually evaluates.
 */

export const priceSchema = z.number().finite().min(0.01).max(0.99);
const cents = (max: number) => z.number().int().min(0).max(max);

const exitShape = z.object({
  /** Sell once the price rises to this. */
  takeProfit: priceSchema.optional(),
  /** Sell once the price falls to this. */
  stopLoss: priceSchema.optional(),
  /** Sell once the price falls this many cents below its highest point. */
  trailingCents: z.number().int().min(1).max(50).optional(),
  /** Sell this many hours before the market closes. */
  exitHoursBeforeEnd: z.number().finite().min(0.25).max(720).optional(),
  /** Share of the position to sell when it fires. */
  sellPercent: z.number().int().min(1).max(100).default(100),
  /** How far below the trigger we'll accept to actually get out. */
  slippageCents: cents(20).default(3),
});

function checkExit(c: z.infer<typeof exitShape>, ctx: z.RefinementCtx) {
  if (c.takeProfit === undefined && c.stopLoss === undefined && c.trailingCents === undefined && c.exitHoursBeforeEnd === undefined) {
    ctx.addIssue({ code: "custom", message: "Set a take-profit, stop-loss, trailing stop or time exit." });
  }
  if (c.takeProfit !== undefined && c.stopLoss !== undefined && c.takeProfit <= c.stopLoss) {
    ctx.addIssue({ code: "custom", message: "Take-profit must be above stop-loss.", path: ["takeProfit"] });
  }
}

export const exitConfig = exitShape.superRefine(checkExit);
export type ExitConfig = z.infer<typeof exitConfig>;

export const entryConfig = z.object({
  /** All-in USD to spend when it fires. */
  amountUsd: z.number().finite().min(1).max(10000),
  /** Buy when the price drops to (below) or rises to (above) `price`. */
  when: z.enum(["below", "above"]),
  price: priceSchema,
  slippageCents: cents(20).default(2),
  /** Protect the new position automatically once bought. */
  thenExit: exitShape.omit({ exitHoursBeforeEnd: true }).partial({ sellPercent: true, slippageCents: true }).optional(),
});
export type EntryConfig = z.infer<typeof entryConfig>;

export const webhookConfig = z.object({
  /** All-in USD per buy alert. */
  amountUsd: z.number().finite().min(1).max(10000),
  /** Never pay more than this per share. */
  maxPrice: priceSchema.default(0.95),
  slippageCents: cents(20).default(3),
  /** Ignore alerts that arrive sooner than this after the last one. */
  cooldownSeconds: z.number().int().min(0).max(3600).default(30),
});
export type WebhookConfig = z.infer<typeof webhookConfig>;

export type AutomationState = { peak?: number; lastSignalAt?: number; attempts?: number };

export function readState(value: unknown): AutomationState {
  const s = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    peak: typeof s.peak === "number" ? s.peak : undefined,
    lastSignalAt: typeof s.lastSignalAt === "number" ? s.lastSignalAt : undefined,
    attempts: typeof s.attempts === "number" ? s.attempts : undefined,
  };
}
