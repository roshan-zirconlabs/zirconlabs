import { prisma } from "@/lib/prisma";
import { PageShell } from "@/components/ui/page";
import StrategyFeedItem from "@/components/strategies/strategy-feed-item";

export const dynamic = "force-dynamic";

export default async function StrategiesPage() {
  const listed = await prisma.bot.findMany({
    where: { listedAt: { not: null }, keeperhubWorkflowId: { not: null } },
    orderBy: { listedAt: "desc" },
    select: { name: true, keeperhubWorkflowId: true, priceUsdc: true },
    take: 60,
  });

  return (
    <PageShell>
      <h1 className="c-serif text-[clamp(2rem,4vw,3rem)] leading-none text-white">Strategy feed</h1>
      <p className="mt-3 max-w-2xl text-[var(--c-dim)]">
        Published Polymarket strategies with a verifiable track record. Every win rate is recomputable from KeeperHub
        runs and on-chain resolution — so an agent can rent a proven edge and pay the author per call, settled through
        KeeperHub&rsquo;s x402 marketplace.
      </p>

      {listed.length === 0 ? (
        <p className="c-panel mt-8 p-6 text-[var(--c-faint)]">No published strategies yet. Publish one from its bot page once it has a resolved trade.</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {listed.map(
            (b) => b.keeperhubWorkflowId && <StrategyFeedItem key={b.keeperhubWorkflowId} name={b.name} workflowId={b.keeperhubWorkflowId} priceUsdc={b.priceUsdc} />,
          )}
        </div>
      )}
    </PageShell>
  );
}
