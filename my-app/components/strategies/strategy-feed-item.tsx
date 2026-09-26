"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { TrackRecord } from "@/lib/track-record";

const money = (n: number) => `${n >= 0 ? "+" : ""}$${n.toFixed(2)}`;

export default function StrategyFeedItem({ name, workflowId }: { name: string; workflowId: string }) {
  const { data } = useQuery({
    queryKey: ["public-record", workflowId],
    queryFn: async (): Promise<TrackRecord> => {
      const res = await fetch(`/api/strategies/${workflowId}/track-record`);
      if (!res.ok) throw new Error("unavailable");
      return res.json();
    },
  });

  const pnl = data?.realizedPnlUsd ?? 0;
  const simulated = data?.basis !== "live";
  return (
    <Link href={`/strategies/${workflowId}`} className="c-panel c-panel-hover block p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-white">{name}</h3>
        {data && (
          <span className={`c-chip shrink-0 !text-[11px] ${simulated ? "border-amber-300/40 bg-amber-50 text-amber-700" : "border-emerald-300/40 bg-emerald-50 text-emerald-700"}`}>
            {simulated ? "Simulated" : "Real money"}
          </span>
        )}
      </div>
      <p className="c-mono mt-1 truncate text-xs text-[var(--c-faint)]">{workflowId}</p>
      <div className="mt-4 flex gap-8">
        <div>
          <p className="c-mono text-[11px] uppercase tracking-wider text-[var(--c-faint)]">Win rate</p>
          <p className="text-xl font-semibold text-white">{data?.winRate != null ? `${data.winRate}%` : "—"}</p>
        </div>
        <div>
          <p className="c-mono text-[11px] uppercase tracking-wider text-[var(--c-faint)]">P&amp;L</p>
          <p className={`text-xl font-semibold ${pnl >= 0 ? "text-[var(--c-up)]" : "text-[var(--c-down)]"}`}>{data ? money(pnl) : "—"}</p>
        </div>
        <div>
          <p className="c-mono text-[11px] uppercase tracking-wider text-[var(--c-faint)]">Resolved</p>
          <p className="text-xl font-semibold text-white">{data ? `${data.wins}/${data.resolved}` : "—"}</p>
        </div>
      </div>
    </Link>
  );
}
