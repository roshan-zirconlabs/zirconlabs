import { prisma } from "./prisma";

/** Finds a bot whose strategy has been published to the public feed. */
export function findListedBot(botId: string) {
  return prisma.bot.findFirst({
    where: { id: botId, listedAt: { not: null } },
    select: { id: true, name: true, listedAt: true },
  });
}

/**
 * A bot's runs in the shape `computeTrackRecord` scores: one record per run,
 * where a run that placed an order carries its market, direction and fill.
 */
export async function executionsForBot(botId: string): Promise<Record<string, unknown>[]> {
  const runs = await prisma.botRun.findMany({ where: { botId }, orderBy: { startedAt: "desc" }, take: 500 });
  return runs.map(r => ({
    id: r.id,
    startedAt: r.startedAt.toISOString(),
    error: r.outcome === "FAILED" ? (r.reason ?? "Run failed") : null,
    traded: r.outcome === "TRADED",
    output: r.outcome === "TRADED"
      ? { data: { marketSlug: r.marketSlug, direction: r.direction, amount: r.amount, shares: r.shares, paper: r.paper !== false } }
      : null,
  }));
}
