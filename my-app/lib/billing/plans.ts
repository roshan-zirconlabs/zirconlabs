/**
 * Plans. A plan caps how many bots run at once; practice and real-money bots
 * count alike. Paid plans last PERIOD_DAYS from payment and stack when renewed
 * early. Prices are in US dollars, paid in stablecoins on Polygon.
 */

export type PlanId = "FREE" | "PRO" | "ENTERPRISE";

export const PLANS: Record<PlanId, { name: string; priceUsd: number; activeBots: number; blurb: string }> = {
  FREE: { name: "Starter", priceUsd: 0, activeBots: 1, blurb: "One bot, practice or real money." },
  PRO: { name: "Trader", priceUsd: 9, activeBots: 5, blurb: "A small fleet for active traders." },
  ENTERPRISE: { name: "Desk", priceUsd: 29, activeBots: 25, blurb: "Room for every strategy you run." },
};

export const PERIOD_DAYS = 30;

/** Drafts are free to keep; this only stops runaway bot creation. */
export const MAX_BOTS_PER_USER = 50;

/** The plan in force now: a paid plan whose period has ended is FREE again. */
export function effectivePlan(sub: { plan: PlanId; currentPeriodEnd: Date | null } | null, now = new Date()): PlanId {
  if (!sub || sub.plan === "FREE") return "FREE";
  return sub.currentPeriodEnd && sub.currentPeriodEnd > now ? sub.plan : "FREE";
}

/** A paid period starts now, or at the end of the current one when renewing early. */
export function extendPeriod(currentEnd: Date | null, now = new Date()): Date {
  const start = currentEnd && currentEnd > now ? currentEnd : now;
  return new Date(start.getTime() + PERIOD_DAYS * 24 * 60 * 60 * 1000);
}
