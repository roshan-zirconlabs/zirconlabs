"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TrackRecord } from "@/lib/track-record";
import TrackRecordView from "@/components/strategies/track-record-view";

type Listing = { listed: boolean; listedAt: string | null; workflowId: string | null; attestationTx: string | null; record: TrackRecord | null };

export default function TrackRecordCard({ botId }: { botId: string }) {
  const client = useQueryClient();
  const { data } = useQuery({
    queryKey: ["listing", botId],
    queryFn: async (): Promise<Listing> => {
      const res = await fetch(`/api/bots/${botId}/listing`);
      if (!res.ok) throw new Error("Could not load listing");
      return res.json();
    },
  });

  const mutate = useMutation({
    mutationFn: async (list: boolean) => {
      const res = await fetch(`/api/bots/${botId}/listing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ list }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not update listing");
      return json;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["listing", botId] }),
  });

  if (!data) return null;
  const { record } = data;
  const canList = (record?.resolved ?? 0) >= 1;

  return (
    <section className="c-panel mt-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Verified track record</h2>
          <p className="mt-1 max-w-xl text-sm text-[var(--c-dim)]">
            Scored from KeeperHub runs against real Polymarket resolution — recomputable by anyone, never self-reported.
          </p>
        </div>
        {data.listed ? (
          <div className="flex flex-wrap items-center gap-2">
            {data.attestationTx && (
              <a href={`https://sepolia.etherscan.io/tx/${data.attestationTx}`} target="_blank" rel="noreferrer" className="c-btn-ghost c-btn-sm !text-[var(--c-up)]">
                On-chain proof ↗
              </a>
            )}
            <Link href={`/strategies/${data.workflowId}`} className="c-btn-ghost c-btn-sm">
              Public page ↗
            </Link>
            <button type="button" onClick={() => mutate.mutate(false)} disabled={mutate.isPending} className="c-btn-ghost c-btn-sm">
              Unpublish
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => mutate.mutate(true)}
            disabled={!canList || mutate.isPending}
            title={canList ? undefined : "Needs at least one resolved trade"}
            className="c-btn-primary c-btn-sm"
          >
            {mutate.isPending ? "Publishing…" : "Publish to feed"}
          </button>
        )}
      </div>

      {mutate.error && <p className="mt-3 text-sm text-[var(--c-down)]">{(mutate.error as Error).message}</p>}

      <div className="mt-5">
        {record ? (
          <TrackRecordView record={record} showProof />
        ) : (
          <p className="text-sm text-[var(--c-faint)]">No verifiable history yet. Once this bot runs and a market resolves, its record appears here.</p>
        )}
      </div>
    </section>
  );
}
