import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { KeeperhubClient } from "@/lib/keeperhub";
import { platformKeeperhubKey } from "@/lib/keeperhub-connection";
import { computeTrackRecord, toPublicRecord, type TrackRecord } from "@/lib/track-record";
import { PageShell } from "@/components/ui/page";
import TrackRecordView from "@/components/strategies/track-record-view";
import RentPanel from "@/components/strategies/rent-panel";

export const dynamic = "force-dynamic";

export default async function StrategyPage({ params }: { params: Promise<{ workflowId: string }> }) {
  const { workflowId } = await params;
  const bot = await prisma.bot.findFirst({
    where: { keeperhubWorkflowId: workflowId, listedAt: { not: null } },
    select: { name: true, listedAt: true, attestationTx: true, priceUsdc: true },
  });
  if (!bot) notFound();

  const key = platformKeeperhubKey();
  let record: TrackRecord | null = null;
  if (key) {
    try {
      const raw = (await new KeeperhubClient(key).getExecutions(workflowId)) as unknown as Record<string, unknown>[];
      record = toPublicRecord(await computeTrackRecord(raw));
    } catch {
      /* record stays null */
    }
  }

  return (
    <PageShell>
      <Link href="/strategies" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-dim)] hover:text-white">
        ← Strategy feed
      </Link>

      <div className="mt-6 mb-8">
        <h1 className="c-serif text-[clamp(2rem,4vw,3rem)] leading-none text-white">{bot.name}</h1>
        <p className="c-mono mt-2 text-xs text-[var(--c-faint)]">Workflow {workflowId}</p>
        {bot.attestationTx && (
          <a
            href={`https://sepolia.etherscan.io/tx/${bot.attestationTx}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[var(--c-up)] hover:border-[var(--c-up)]"
          >
            ● Published on-chain via KeeperHub ↗
          </a>
        )}
      </div>

      {record ? (
        <TrackRecordView record={record} showProof />
      ) : (
        <p className="c-panel p-6 text-[var(--c-faint)]">This strategy&rsquo;s record is unavailable right now.</p>
      )}

      <RentPanel workflowId={workflowId} priceUsdc={bot.priceUsdc} />

      <section className="c-panel mt-6 p-6">
        <h2 className="font-semibold">Verify before you pay</h2>
        <p className="mt-1 text-sm text-[var(--c-dim)]">
          Settled trades come with proof (KeeperHub execution ids and on-chain condition ids) anyone can recompute — no
          trust required. Open positions are withheld: the live signal is what renting buys.
        </p>
        <code className="c-mono mt-4 block overflow-x-auto rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-[var(--c-pink)]">
          GET /api/strategies/{workflowId}/track-record
        </code>
      </section>
    </PageShell>
  );
}
