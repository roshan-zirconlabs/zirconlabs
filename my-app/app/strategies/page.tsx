import { prisma } from "@/lib/prisma";
import { PageShell } from "@/components/ui/page";
import StrategyFeedItem from "@/components/strategies/strategy-feed-item";

export const dynamic = "force-dynamic";

export default async function StrategiesPage() {
  const listed = await prisma.bot.findMany({
    where: { listedAt: { not: null } },
    orderBy: { listedAt: "desc" },
    select: { id: true, name: true },
    take: 60,
  });

  return (
    <PageShell>
      <h1 className="c-serif text-[clamp(2rem,4vw,3rem)] leading-none text-white">Strategy feed</h1>
      <p className="mt-3 max-w-2xl text-[var(--c-dim)]">
        Published Polymarket strategies with a verifiable track record. Every win rate is recomputed from the bot&rsquo;s
        run log and Polymarket&rsquo;s on-chain resolution, and every record says whether it comes from real orders or simulated practice
        fills.
      </p>

      {listed.length === 0 ? (
        <p className="c-panel mt-8 p-6 text-[var(--c-faint)]">No published strategies yet. Publish one from its bot page once it has a resolved trade.</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {listed.map(
            (b) => <StrategyFeedItem key={b.id} name={b.name} workflowId={b.id} />,
          )}
        </div>
      )}
    </PageShell>
  );
}
