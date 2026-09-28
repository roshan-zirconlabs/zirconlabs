/** Prisma Decimals (and nullable numerics) to plain numbers at the edges. */
export const num = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

function decimals(step: number) {
  const s = String(step);
  return s.includes(".") ? s.split(".")[1].length : 0;
}

/**
 * Snaps a price onto the market's tick grid in the protective direction:
 * a buy's ceiling rounds down (never pay more), a sell's floor rounds up
 * (never accept less). Always stays strictly inside (0, 1).
 */
export function toTick(price: number, tick: number, direction: "down" | "up"): number {
  const steps = price / tick;
  const snapped = (direction === "down" ? Math.floor(steps + 1e-9) : Math.ceil(steps - 1e-9)) * tick;
  const bounded = Math.min(1 - tick, Math.max(tick, snapped));
  return Number(bounded.toFixed(decimals(tick)));
}

export const usd = (n: number) => `${n < 0 ? "−" : ""}$${Math.abs(n).toFixed(2)}`;
