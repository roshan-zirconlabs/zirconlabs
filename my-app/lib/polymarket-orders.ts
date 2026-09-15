import { z } from "zod";
import { buyInput, MarketError, type BuyInput } from "./polymarket-markets";

export const orderInput = buyInput.extend({ requestId: z.uuid(), confirm: z.literal(true) }).strict();
export type OrderInput = z.infer<typeof orderInput>;

export function assertBudget(limit: number, reserved: number, amount: number) {
  if (![limit, reserved, amount].every(Number.isFinite) || amount <= 0 || reserved < 0 || Math.round(reserved * 100) + Math.round(amount * 100) > Math.round(limit * 100)) throw new MarketError("This order would exceed your daily spend limit, including pending orders.", 409);
}

export function assertSameRequest(existing: { marketSlug: string; outcome: string; amountUsd: unknown; maxPrice: unknown }, input: BuyInput) {
  if (existing.marketSlug !== input.marketSlug || existing.outcome !== input.outcome || Number(existing.amountUsd) !== input.amountUsd || Number(existing.maxPrice) !== input.maxPrice) throw new MarketError("This request was already used for a different order. Review a new order before submitting.", 409);
}
