import type { AutomationState, EntryConfig, ExitConfig } from "./config";

/**
 * Pure trigger logic: given the current price, does an automation fire, and at
 * what price limit? No I/O here, so every rule is unit-tested.
 *
 * Triggers read the midpoint. Protective exits (stop-loss, trailing, time) are
 * priced off the current midpoint minus slippage so they actually get out even
 * if the price gapped past the trigger; take-profit never sells below the
 * target minus slippage.
 */

export type Trigger = "take-profit" | "stop-loss" | "trailing-stop" | "time-exit" | "entry";
export type Decision = { trigger: Trigger; limitPrice: number; reason: string } | null;

const clamp = (p: number) => Math.min(0.99, Math.max(0.01, Number(p.toFixed(4))));
export const cents = (p: number) => `${Math.round(p * 1000) / 10}¢`;

export function evaluateExit(
  config: ExitConfig,
  state: AutomationState,
  mid: number,
  now: number,
  endDate: Date | null,
): { decision: Decision; state: AutomationState } {
  const peak = Math.max(state.peak ?? mid, mid);
  const next = { ...state, peak };
  const slip = config.slippageCents / 100;

  if (config.stopLoss !== undefined && mid <= config.stopLoss) {
    return { state: next, decision: { trigger: "stop-loss", limitPrice: clamp(mid - slip), reason: `Stop-loss hit: price ${cents(mid)} is at or below ${cents(config.stopLoss)}.` } };
  }
  if (config.trailingCents !== undefined && mid <= peak - config.trailingCents / 100 + 1e-9) {
    return { state: next, decision: { trigger: "trailing-stop", limitPrice: clamp(mid - slip), reason: `Trailing stop hit: price ${cents(mid)} fell ${config.trailingCents}¢ from its high of ${cents(peak)}.` } };
  }
  if (config.exitHoursBeforeEnd !== undefined && endDate && now >= endDate.getTime() - config.exitHoursBeforeEnd * 3_600_000) {
    return { state: next, decision: { trigger: "time-exit", limitPrice: clamp(mid - slip), reason: `Time exit: the market closes within ${config.exitHoursBeforeEnd} hours.` } };
  }
  if (config.takeProfit !== undefined && mid >= config.takeProfit) {
    return { state: next, decision: { trigger: "take-profit", limitPrice: clamp(config.takeProfit - slip), reason: `Take-profit hit: price ${cents(mid)} reached ${cents(config.takeProfit)}.` } };
  }
  return { state: next, decision: null };
}

export function evaluateEntry(config: EntryConfig, mid: number): Decision {
  const slip = config.slippageCents / 100;
  if (config.when === "below" && mid <= config.price) {
    return { trigger: "entry", limitPrice: clamp(config.price + slip), reason: `Entry: price ${cents(mid)} dropped to ${cents(config.price)}.` };
  }
  if (config.when === "above" && mid >= config.price) {
    return { trigger: "entry", limitPrice: clamp(mid + slip), reason: `Entry: price ${cents(mid)} rose to ${cents(config.price)}.` };
  }
  return null;
}

/**
 * Maps an alert's wording onto an action. TradingView sends
 * `{{strategy.order.action}}` as buy/sell; people also write long/short or
 * close/exit. Anything else is refused rather than guessed.
 */
export function alertAction(value: unknown): "buy" | "sell" | null {
  if (typeof value !== "string") return null;
  const word = value.trim().toLowerCase();
  if (["buy", "long", "open", "enter", "entry"].includes(word)) return "buy";
  if (["sell", "short", "close", "exit", "flat"].includes(word)) return "sell";
  return null;
}
