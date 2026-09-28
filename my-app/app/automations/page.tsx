"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Pause, Play, RefreshCw, Trash2 } from "lucide-react";
import { PageHeader, PageShell, EmptyState, Notice, StatusBadge } from "@/components/ui/page";
import Skeleton from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import EngineStatus from "@/components/app/engine-status";
import { api, ago, cents, useMe } from "@/lib/client";

type Automation = {
  id: string; mode: "PAPER" | "LIVE"; kind: "EXIT" | "ENTRY" | "WEBHOOK"; status: "ACTIVE" | "PAUSED" | "DONE" | "FAILED";
  marketSlug: string; question: string; outcome: string; summary: string; lastPrice: number | null;
  lastCheckedAt: string | null; lastError: string | null; firedAt: string | null; createdAt: string;
};

const KIND = { EXIT: "Protection", ENTRY: "Buy at a price", WEBHOOK: "TradingView" } as const;

export default function AutomationsPage() {
  const { data: me } = useMe();
  const mode = me?.mode ?? "PAPER";
  const { data, isLoading, error } = useQuery({
    queryKey: ["automations", mode],
    queryFn: () => api<{ automations: Automation[] }>(`/api/automations?mode=${mode}`),
    enabled: !!me,
    refetchInterval: 15_000,
  });
  const list = data?.automations ?? [];
  const running = list.filter((a) => a.status === "ACTIVE" || a.status === "PAUSED" || a.status === "FAILED");
  const finished = list.filter((a) => a.status === "DONE");

  return (
    <PageShell width="medium">
      <PageHeader
        eyebrow={mode === "LIVE" ? "Live" : "Practice"}
        title="Automations"
        description="Everything Zircon is watching for you. Add protection or a price entry from any market page."
      />
      <div className="mb-4"><EngineStatus hasActive={running.some((a) => a.status === "ACTIVE")} /></div>
      {error && <Notice tone="error">{(error as Error).message}</Notice>}
      {isLoading ? <Skeleton className="h-40 w-full" /> : running.length === 0 && finished.length === 0 ? (
        <EmptyState title="Nothing automated yet" body="Open a market to buy with a take-profit and stop-loss, set a price to buy at, or connect a TradingView alert." action={<Link href="/markets" className="c-btn-primary">Browse markets</Link>} />
      ) : (
        <>
          <ul className="space-y-3">{running.map((a) => <Row key={a.id} a={a} />)}</ul>
          {finished.length > 0 && (
            <>
              <h2 className="mb-3 mt-10 text-sm font-semibold text-[var(--c-dim)]">Finished</h2>
              <ul className="space-y-2">{finished.slice(0, 20).map((a) => <Row key={a.id} a={a} />)}</ul>
            </>
          )}
        </>
      )}
    </PageShell>
  );
}

function Row({ a }: { a: Automation }) {
  const client = useQueryClient();
  const { toast } = useToast();
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const refresh = () => client.invalidateQueries({ queryKey: ["automations"] });

  const setStatus = useMutation({
    mutationFn: (status: "ACTIVE" | "PAUSED") => api(`/api/automations/${a.id}`, { method: "PATCH", json: { status } }),
    onSuccess: refresh,
    onError: (e) => toast({ variant: "error", title: "Couldn't update it", description: e.message }),
  });
  const cancel = useMutation({
    mutationFn: () => api(`/api/automations/${a.id}`, { method: "DELETE" }),
    onSuccess: refresh,
    onError: (e) => toast({ variant: "error", title: "Couldn't cancel it", description: e.message }),
  });
  const rotate = useMutation({
    mutationFn: () => api<{ webhookUrl: string }>(`/api/automations/${a.id}`, { method: "PATCH", json: { rotateSecret: true } }),
    onSuccess: (r) => setUrl(r.webhookUrl),
    onError: (e) => toast({ variant: "error", title: "Couldn't make a new link", description: e.message }),
  });

  const badge = a.status === "ACTIVE" ? <StatusBadge tone="active" pulse>Watching</StatusBadge>
    : a.status === "PAUSED" ? <StatusBadge tone="paused">Paused</StatusBadge>
    : a.status === "FAILED" ? <StatusBadge tone="danger">Needs attention</StatusBadge>
    : <StatusBadge tone="paused">Done</StatusBadge>;

  return (
    <li className="c-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {badge}
            <span className="c-mono text-[11px] uppercase tracking-wider text-[var(--c-faint)]">{KIND[a.kind]}</span>
          </div>
          <p className="mt-2 text-white">{a.summary}</p>
          <Link href={`/markets/${a.marketSlug}`} className="mt-1 block truncate text-xs text-[var(--c-dim)] hover:text-white">{a.question}</Link>
          <p className="mt-2 text-xs text-[var(--c-faint)]">
            {a.kind === "WEBHOOK" ? `Last alert ${ago(a.lastCheckedAt)}` : `Price ${cents(a.lastPrice)} · checked ${ago(a.lastCheckedAt)}`}
            {a.firedAt && ` · fired ${ago(a.firedAt)}`}
          </p>
          {a.lastError && a.status !== "DONE" && <p className="mt-2 text-xs text-amber-300">{a.lastError}</p>}
        </div>
        {a.status !== "DONE" && (
          <div className="flex shrink-0 gap-1.5">
            {a.status === "ACTIVE"
              ? <button onClick={() => setStatus.mutate("PAUSED")} className="c-btn-ghost c-btn-sm" aria-label="Pause"><Pause className="h-3.5 w-3.5" /></button>
              : <button onClick={() => setStatus.mutate("ACTIVE")} className="c-btn-ghost c-btn-sm" aria-label="Resume"><Play className="h-3.5 w-3.5" /></button>}
            {a.kind === "WEBHOOK" && (
              <button onClick={() => { if (confirm("Make a new link? The old one stops working immediately.")) rotate.mutate(); }} className="c-btn-ghost c-btn-sm" aria-label="New webhook link"><RefreshCw className="h-3.5 w-3.5" /></button>
            )}
            <button onClick={() => { if (confirm("Cancel this automation?")) cancel.mutate(); }} className="c-btn-ghost c-btn-sm" aria-label="Cancel"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>
      {url && (
        <div className="mt-3 flex gap-2 border-t border-white/10 pt-3">
          <input readOnly value={url} className="c-input c-mono !text-xs" onFocus={(e) => e.target.select()} />
          <button onClick={() => { navigator.clipboard.writeText(url); setCopied(true); }} className="c-btn-ghost shrink-0" aria-label="Copy link">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button>
        </div>
      )}
    </li>
  );
}
