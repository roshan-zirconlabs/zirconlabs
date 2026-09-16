"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChartLine, Clock, ExternalLink, RefreshCw, Search, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { EmptyState, Notice, PageHeader, PageShell, StatusBadge } from "@/components/ui/page";
import Skeleton from "@/components/ui/skeleton";

type BtcMarket = {
  slug: string;
  timeframe: string;
  startTs: number;
  endTs: number;
  upTokenId: string;
  downTokenId: string;
  upPrice: number | null;
  downPrice: number | null;
};

const FILTERS = [
  { id: "all", label: "All windows" },
  { id: "15m", label: "15 min" },
  { id: "1h", label: "1 hour" },
  { id: "4h", label: "4 hours" },
  { id: "1d", label: "Daily" },
];

function formatTimeLeft(sec: number): string {
  if (sec <= 0) return "Resolving";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

// Only this label re-renders every second, not the whole market grid.
function Countdown({ startTs, endTs }: { startTs: number; endTs: number }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  if (startTs > now) return <span>Opens in {formatTimeLeft(startTs - now)}</span>;
  return <span>{formatTimeLeft(endTs - now)}</span>;
}

export default function MarketsPage() {
  const [filter, setFilter] = useState("all");
  const markets = useQuery({
    queryKey: ["btc-markets"],
    refetchInterval: 30_000,
    queryFn: async (): Promise<BtcMarket[]> => {
      const res = await fetch("/api/markets", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || (json.error && !json.markets?.length)) throw new Error(json.error || "Failed to connect to Polymarket.");
      return json.markets ?? [];
    },
  });

  const list = markets.data ?? [];
  const filtered = filter === "all" ? list : list.filter((m) => m.timeframe === filter);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Observatory"
        title="Live"
        accent="markets."
        description="Bitcoin up-or-down windows on Polymarket, with live odds. Prices refresh every 30 seconds."
        actions={
          <>
            <Link href="/trade" className="c-btn-ghost">
              <Search className="h-4 w-4" /> Search all markets
            </Link>
            <Link href="/markets/graphs" className="c-btn-ghost">
              <ChartLine className="h-4 w-4" /> Charts
            </Link>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="c-tabs flex-wrap" role="group" aria-label="Filter by window">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" className="c-tab" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => void markets.refetch()} disabled={markets.isFetching} className="c-btn-ghost c-btn-sm">
          <RefreshCw className={`h-3.5 w-3.5 ${markets.isFetching ? "animate-spin" : ""}`} />
          {markets.isFetching ? "Refreshing" : "Refresh"}
        </button>
      </div>

      {markets.error && (
        <div className="mb-6">
          <Notice tone="error">{(markets.error as Error).message}</Notice>
        </div>
      )}

      {markets.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        !markets.error && <EmptyState title="Quiet skies" body="No open markets for this window right now. They rotate automatically — check back shortly." />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((m) => {
            const up = m.upPrice ?? 0.5;
            const down = m.downPrice ?? 0.5;
            const upPct = Math.round(up * 100);
            const downPct = Math.round(down * 100);
            return (
              <li key={m.slug} className="c-panel c-panel-hover flex flex-col p-6">
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge tone="practice">BTC · {m.timeframe}</StatusBadge>
                  <span className="c-mono flex items-center gap-1.5 text-xs text-[var(--c-dim)]">
                    <Clock className="h-3.5 w-3.5 text-[var(--c-pink)]" />
                    <Countdown startTs={m.startTs} endTs={m.endTs} />
                  </span>
                </div>
                <h2 className="c-mono mt-4 truncate text-sm text-white" title={m.slug}>
                  {m.slug}
                </h2>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-emerald-300/30 bg-emerald-50 p-4">
                    <div className="flex items-center justify-between text-xs text-[var(--c-up)]">
                      <span>Up</span>
                      <TrendingUp className="h-3.5 w-3.5" />
                    </div>
                    <p className="c-serif mt-2 text-4xl leading-none text-white">{upPct}¢</p>
                  </div>
                  <div className="rounded-2xl border border-rose-300/30 bg-rose-50 p-4">
                    <div className="flex items-center justify-between text-xs text-[var(--c-down)]">
                      <span>Down</span>
                      <TrendingDown className="h-3.5 w-3.5" />
                    </div>
                    <p className="c-serif mt-2 text-4xl leading-none text-white">{downPct}¢</p>
                  </div>
                </div>

                <div className="mt-4" aria-label={`Market odds: ${upPct}% up, ${downPct}% down`}>
                  <div className="flex h-1.5 overflow-hidden rounded-full bg-[rgba(251,127,154,0.45)]">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#22c58b] to-[#5ee0a6]" style={{ width: `${upPct}%` }} />
                  </div>
                  <div className="c-mono mt-1.5 flex justify-between text-[11px] text-[var(--c-faint)]">
                    <span>{(up * 100).toFixed(1)}% up</span>
                    <span>{(down * 100).toFixed(1)}% down</span>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between gap-2 border-t border-white/10 pt-5">
                  <a
                    href={`https://polymarket.com/market/${m.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-[var(--c-dim)] hover:text-white"
                  >
                    Polymarket <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <Link href="/bots" className="c-btn-primary c-btn-sm">
                    <Zap className="h-3.5 w-3.5" /> Automate
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
