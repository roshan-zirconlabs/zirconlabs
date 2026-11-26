import Link from "next/link";
import { notFound } from "next/navigation";
import { executionsForBot, findListedBot } from "@/lib/run-history";
import { computeTrackRecord, toPublicRecord, type TrackRecord } from "@/lib/track-record";
import { PageShell } from "@/components/ui/page";
import TrackRecordView from "@/components/strategies/track-record-view";

export const dynamic = "force-dynamic";

export default async function StrategyPage({ params }: { params: Promise<{ workflowId: string }> }) {
  const { workflowId } = await params;
  const bot = await findListedBot(workflowId);
  if (!bot) notFound();

  let record: TrackRecord | null = null;
  try {
    record = toPublicRecord(await computeTrackRecord(await executionsForBot(bot.id)));
  } catch {
    /* record stays null */
  }

  return (
    <PageShell>
      <Link href="/strategies" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-dim)] hover:text-white">
        ← Strategy feed
      </Link>

      <div className="mt-6 mb-8">
        <h1 className="c-serif text-[clamp(2rem,4vw,3rem)] leading-none text-white">{bot.name}</h1>
        <p className="c-mono mt-2 text-xs text-[var(--c-faint)]">Strategy {workflowId}</p>
      </div>

      {record ? (
        <TrackRecordView record={record} showProof />
      ) : (
        <p className="c-panel p-6 text-[var(--c-faint)]">This strategy&rsquo;s record is unavailable right now.</p>
      )}

      <section className="c-panel mt-6 p-6">
        <h2 className="font-semibold">Verify it yourself</h2>
        <p className="mt-1 text-sm text-[var(--c-dim)]">
          Settled trades come with proof (on-chain condition ids) anyone can recompute — no
          trust required. Open positions are withheld until their market resolves.
        </p>
        <code className="c-mono mt-4 block overflow-x-auto rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-[var(--c-pink)]">
          GET /api/strategies/{workflowId}/track-record
        </code>
      </section>
    </PageShell>
  );
}
