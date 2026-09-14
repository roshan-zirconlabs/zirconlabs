/** A quote-time fill-or-kill simulation, not an exchange execution or backtest. */
export function simulateBuy(asks: { price: string; size: string }[], amount: number, maxPrice: number) {
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10000 || !Number.isFinite(maxPrice) || maxPrice <= 0 || maxPrice > 1) throw new Error("Invalid paper order amount or price limit.");
  const levels = asks.map(a => ({ price: Number(a.price), size: Number(a.size) }));
  if (levels.some(a => !Number.isFinite(a.price) || !Number.isFinite(a.size) || a.price <= 0 || a.price > 1 || a.size < 0)) throw new Error("Invalid order book.");
  levels.sort((a, b) => a.price - b.price);
  let remaining = amount; let shares = 0;
  for (const level of levels) {
    if (level.price > maxPrice) break;
    const spend = Math.min(remaining, level.price * level.size);
    shares += spend / level.price; remaining -= spend;
    if (remaining < 1e-8) break;
  }
  if (remaining > 1e-8 || shares <= 0) throw new Error("Insufficient ask liquidity within the price limit. No paper fill recorded.");
  return { amount, shares, price: amount / shares };
}
