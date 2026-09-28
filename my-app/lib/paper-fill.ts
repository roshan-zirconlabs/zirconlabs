import type { FeeSchedule } from "./polymarket/markets";
import type { Level } from "./polymarket/prices";

/**
 * Practice fills, walked against the real order book with the market's real
 * taker fee: fee (USD) = shares × rate × (p × (1 − p))^exponent
 * (https://docs.polymarket.com/trading/fees, checked 2026-09-29).
 *
 * These are fill-and-kill: whatever the book offers within the price limit
 * fills, the rest is dropped — the same as the live market orders we place.
 */

export class FillError extends Error {}

export function takerFee(shares: number, price: number, fee: FeeSchedule | null): number {
  if (!fee || shares <= 0) return 0;
  return shares * fee.rate * Math.pow(price * (1 - price), fee.exponent);
}

export type Fill = { shares: number; usd: number; feeUsd: number; avgPrice: number };

/**
 * Spends up to `budgetUsd` all-in (fees included), never paying more than
 * `maxPrice` per share. `asks` must be best (lowest) first.
 */
export function simulateBuy(asks: Level[], budgetUsd: number, maxPrice: number, fee: FeeSchedule | null): Fill {
  if (!(budgetUsd > 0) || !(maxPrice > 0 && maxPrice < 1)) throw new FillError("Invalid order amount or price limit.");
  let remaining = budgetUsd;
  let shares = 0;
  let spent = 0;
  let feeUsd = 0;
  for (const level of asks) {
    if (level.price > maxPrice || remaining <= 1e-9) break;
    // All-in cost of one share at this level, fee included.
    const unit = level.price + takerFee(1, level.price, fee);
    const take = Math.min(level.size, remaining / unit);
    if (take <= 0) continue;
    shares += take;
    spent += take * level.price;
    feeUsd += takerFee(take, level.price, fee);
    remaining -= take * unit;
  }
  if (shares <= 1e-9) throw new FillError(`Nothing is offered at or below ${Math.round(maxPrice * 100)}¢ right now.`);
  return { shares, usd: spent + feeUsd, feeUsd, avgPrice: spent / shares };
}

/**
 * Sells up to `shares`, never accepting less than `minPrice` per share.
 * `bids` must be best (highest) first. Proceeds are after fees.
 */
export function simulateSell(bids: Level[], shares: number, minPrice: number, fee: FeeSchedule | null): Fill {
  if (!(shares > 0) || !(minPrice > 0 && minPrice < 1)) throw new FillError("Invalid order size or price limit.");
  let remaining = shares;
  let sold = 0;
  let gross = 0;
  let feeUsd = 0;
  for (const level of bids) {
    if (level.price < minPrice || remaining <= 1e-9) break;
    const take = Math.min(level.size, remaining);
    sold += take;
    gross += take * level.price;
    feeUsd += takerFee(take, level.price, fee);
    remaining -= take;
  }
  if (sold <= 1e-9) throw new FillError(`No one is buying at or above ${Math.round(minPrice * 100)}¢ right now.`);
  return { shares: sold, usd: gross - feeUsd, feeUsd, avgPrice: gross / sold };
}
