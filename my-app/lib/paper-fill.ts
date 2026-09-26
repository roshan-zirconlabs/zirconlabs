/**
 * Polymarket's taker fee rate for crypto markets.
 * fee (USDC) = shares × feeRate × p × (1 − p) — https://docs.polymarket.com/trading/fees (checked 2026-09-27).
 * About 3.5% of notional at 50¢, which is where up/down bots usually buy.
 */
export const CRYPTO_TAKER_FEE_RATE = 0.07;

/**
 * A quote-time fill-or-kill simulation, not an exchange execution or backtest.
 *
 * With a fee rate, the fee is paid out of the stake, so the total cost stays at
 * `amount` and the fill buys fewer shares — a paper result is never better than
 * the same order would have been live.
 */
export function simulateBuy(asks: { price: string; size: string }[], amount: number, maxPrice: number, feeRate = 0) {
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10000 || !Number.isFinite(maxPrice) || maxPrice <= 0 || maxPrice > 1) throw new Error("Invalid paper order amount or price limit.");
  if (!Number.isFinite(feeRate) || feeRate < 0 || feeRate >= 1) throw new Error("Invalid fee rate.");
  const levels = asks.map(a => ({ price: Number(a.price), size: Number(a.size) }));
  if (levels.some(a => !Number.isFinite(a.price) || !Number.isFinite(a.size) || a.price <= 0 || a.price > 1 || a.size < 0)) throw new Error("Invalid order book.");
  levels.sort((a, b) => a.price - b.price);
  let remaining = amount; let shares = 0; let fee = 0;
  for (const level of levels) {
    if (level.price > maxPrice) break;
    const spend = Math.min(remaining, level.price * level.size);
    const bought = spend / level.price;
    shares += bought; remaining -= spend;
    fee += bought * feeRate * level.price * (1 - level.price);
    if (remaining < 1e-8) break;
  }
  if (remaining > 1e-8 || shares <= 0) throw new Error("Insufficient ask liquidity within the price limit. No paper fill recorded.");
  const net = shares * (amount / (amount + fee));
  return { amount, shares: net, price: amount / net };
}
