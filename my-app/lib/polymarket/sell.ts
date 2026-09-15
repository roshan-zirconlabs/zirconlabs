import { z } from "zod";

/**
 * Closing a position: selling outcome shares back to the order book.
 *
 * A buy is denominated in dollars, but a sell is denominated in shares — you
 * can only sell what you hold. The two are not interchangeable, and treating
 * one as the other would either oversell or silently sell a fraction.
 */

export class SellError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "SellError";
  }
}

export const sellInput = z.object({
  assetId: z.string().trim().regex(/^\d+$/, "Choose one of your positions."),
  /** Shares to sell, or "all" to close the position completely. */
  shares: z.union([z.number().finite().positive(), z.literal("all")]),
  /** Refuse to sell below this price per share. */
  minPrice: z.number().finite().gt(0).lt(1),
  requestId: z.uuid(),
  confirm: z.literal(true),
}).strict();

export type SellInput = z.infer<typeof sellInput>;

/**
 * Resolves how many shares to sell against what the wallet actually holds.
 * Selling more than is held would be rejected on-chain after signing, so it is
 * refused here instead of being clamped to something the user did not ask for.
 */
export function resolveShares(requested: number | "all", held: number, minOrderSize: number): number {
  if (!Number.isFinite(held) || held <= 0) {
    throw new SellError("You no longer hold any shares in this position.", 409);
  }
  const shares = requested === "all" ? held : requested;
  if (shares > held + 1e-9) {
    throw new SellError(`You asked to sell ${shares} shares but hold only ${held}.`, 409);
  }
  if (shares + 1e-9 < minOrderSize) {
    throw new SellError(
      `This market's minimum order is ${minOrderSize} shares. Sell at least that many, or close the whole position.`,
      409,
    );
  }
  // Never round up past the balance; trim to the held amount.
  return Math.min(shares, held);
}

/** The proceeds a sell would realise against the current bids, in dollars. */
export function simulateSell(bids: { price: string; size: string }[], shares: number, minPrice: number) {
  if (!Number.isFinite(shares) || shares <= 0 || !Number.isFinite(minPrice) || minPrice <= 0 || minPrice >= 1) {
    throw new SellError("Invalid share amount or price floor.");
  }
  const levels = bids.map(b => ({ price: Number(b.price), size: Number(b.size) }));
  if (levels.some(l => !Number.isFinite(l.price) || !Number.isFinite(l.size) || l.price <= 0 || l.price > 1 || l.size < 0)) {
    throw new SellError("The order book could not be read.", 502);
  }
  // Best price first: a seller wants the highest bids.
  levels.sort((a, b) => b.price - a.price);
  let remaining = shares;
  let proceeds = 0;
  for (const level of levels) {
    if (level.price < minPrice) break;
    const take = Math.min(remaining, level.size);
    proceeds += take * level.price;
    remaining -= take;
    if (remaining < 1e-9) break;
  }
  if (remaining > 1e-9) {
    throw new SellError(`Not enough demand at or above ${minPrice} to sell ${shares} shares. Lower the floor or sell fewer.`, 409);
  }
  return { shares, proceeds, price: proceeds / shares };
}
