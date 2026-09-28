"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import Skeleton from "@/components/ui/skeleton";
import { api, ago, type Mode } from "@/lib/client";

type Row = { id: string; level: "INFO" | "SUCCESS" | "WARNING" | "ERROR"; title: string; detail: string | null; createdAt: string };

const ICON = {
  INFO: <Info className="h-4 w-4 text-[var(--c-faint)]" />,
  SUCCESS: <CheckCircle2 className="h-4 w-4 text-[var(--c-up)]" />,
  WARNING: <AlertTriangle className="h-4 w-4 text-amber-300" />,
  ERROR: <XCircle className="h-4 w-4 text-[var(--c-down)]" />,
};

export default function ActivityFeed({ mode, limit = 15 }: { mode: Mode; limit?: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["activity", mode],
    queryFn: () => api<{ activity: Row[] }>(`/api/activity?mode=${mode}`),
    refetchInterval: 15_000,
  });
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  const rows = data?.activity.slice(0, limit) ?? [];
  if (!rows.length) return <p className="text-sm text-[var(--c-faint)]">Nothing yet. Trades, automations and alerts will show up here.</p>;
  return (
    <ol className="space-y-3">
      {rows.map((r) => (
        <li key={r.id} className="flex gap-3">
          <span className="mt-0.5 shrink-0">{ICON[r.level]}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white">{r.title}</p>
            {r.detail && (
              <p className="break-words text-xs text-[var(--c-faint)]">
                {/^https:\/\/polygonscan\.com\/tx\//.test(r.detail) ? <a href={r.detail} target="_blank" rel="noreferrer" className="underline">View transaction</a> : r.detail}
              </p>
            )}
          </div>
          <time className="shrink-0 text-xs text-[var(--c-faint)]" dateTime={r.createdAt}>{ago(r.createdAt)}</time>
        </li>
      ))}
    </ol>
  );
}
