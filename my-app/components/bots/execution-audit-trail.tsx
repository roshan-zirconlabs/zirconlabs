"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Notice, StatTile } from "@/components/ui/page";
import Skeleton from "@/components/ui/skeleton";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MinusCircle,
  RefreshCw,
  Sparkles,
  XCircle,
} from "lucide-react";

type TradeRow = {
  id: string; marketSlug: string; direction: string; side: string;
  amountUsd: number; price: number; shares: number | null; status: string;
  paper: boolean; orderId: string | null; executedAt: string;
  outcome: "OPEN" | "WON" | "LOST" | "N/A"; pnlUsd: number | null;
  redeemable: boolean; conditionId: string | null;
};
type RunRow = {
  kind: "TRADED" | "SAT_OUT" | "FAILED"; reason: string | null;
  marketSlug: string | null; direction: string | null; amount: number | null; price: number | null;
  startedAt: string | null; durationMs: number | null;
};
type Stats = {
  totalTrades: number; filled: number; wins: number; losses: number; open: number;
  resolvedCount: number; winRate: number | null; totalStakedUsd: number; realizedPnlUsd: number;
  liveCount: number; paperCount: number;
};
type Analysis = { stats: Stats; trades: TradeRow[]; runs: RunRow[]; runsWarning?: string };

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "That did not work.");
  return data as T;
}

export default function ExecutionAuditTrail({ botId }: { botId: string }) {
  const [data, setData] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [tab, setTab] = useState<"trades" | "runs">("trades");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setData(await call<Analysis>(`/api/bots/${botId}/analysis`, { cache: "no-store" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load trade history.");
    } finally { setLoading(false); }
  }, [botId]);

  useEffect(() => { void load(); }, [load]);

  async function claim(trade: TradeRow) {
    if (!trade.conditionId) return;
    if (!window.confirm(`Claim your winnings from ${trade.marketSlug}? This converts the winning shares into spendable balance.`)) return;
    setClaiming(trade.id); setError(null); setNotice(null);
    try {
      const res = await call<{ message: string }>("/api/wallet/redeem", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conditionId: trade.conditionId, confirm: true }),
      });
      setNotice(res.message);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Redemption failed."); }
    finally { setClaiming(null); }
  }

  if (loading && !data) return <Skeleton className="h-96" />;
  if (error && !data) return <Notice tone="error">{error}</Notice>;
  if (!data) return null;

  const { stats, trades, runs, runsWarning } = data;
  const redeemableTrades = trades.filter(t => t.redeemable);
  const pnlTone = stats.realizedPnlUsd > 0 ? "good" : stats.realizedPnlUsd < 0 ? "bad" : "default";

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Win rate" value={stats.winRate != null ? `${stats.winRate}%` : "—"} tone="accent" hint={`${stats.wins} won · ${stats.losses} lost`} />
        <StatTile label="Realized P&L" value={`${stats.realizedPnlUsd >= 0 ? "+" : "−"}$${Math.abs(stats.realizedPnlUsd).toFixed(2)}`} tone={pnlTone} hint="From resolved markets" />
        <StatTile label="Staked so far" value={`$${stats.totalStakedUsd.toFixed(2)}`} hint={stats.liveCount > 0 && stats.paperCount > 0 ? `${stats.liveCount} live · ${stats.paperCount} practice` : stats.liveCount > 0 ? "Live only" : "Practice only"} />
        <StatTile label="Open positions" value={stats.open} hint="Awaiting market close" />
      </div>

      {redeemableTrades.length > 0 && (
        <div className="space-y-2">
          {redeemableTrades.map(t => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-300/40 bg-emerald-50 px-5 py-4">
              <span className="flex min-w-0 items-center gap-3 text-sm">
                <Sparkles className="h-5 w-5 shrink-0 text-[var(--c-up)]" />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-white">{t.marketSlug} won</span>
                  <span className="block text-xs text-[var(--c-dim)]">+${t.pnlUsd?.toFixed(2)} ready to claim</span>
                </span>
              </span>
              <button onClick={() => void claim(t)} disabled={claiming !== null} className="c-btn-primary c-btn-sm">
                {claiming === t.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Claim winnings
              </button>
            </div>
          ))}
        </div>
      )}

      {notice && <Notice tone="success">{notice}</Notice>}
      {error && data && <Notice tone="error">{error}</Notice>}

      <div className="c-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="c-tabs" role="tablist" aria-label="History view">
            <button role="tab" aria-selected={tab === "trades"} onClick={() => setTab("trades")} className="c-tab">
              Trades <span className="c-mono ml-1 text-xs opacity-70">{trades.length}</span>
            </button>
            <button role="tab" aria-selected={tab === "runs"} onClick={() => setTab("runs")} className="c-tab">
              Every run <span className="c-mono ml-1 text-xs opacity-70">{runs.length}</span>
            </button>
          </div>
          <button onClick={() => void load()} disabled={loading} className="c-btn-ghost c-btn-sm">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {tab === "trades" && (
          trades.length === 0 ? (
            <p className="px-6 py-14 text-center text-sm text-[var(--c-dim)]">No trades yet. They&rsquo;ll appear here as soon as the bot runs and its rule fires.</p>
          ) : (
            <ul>
              {trades.map(t => (
                <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/5 px-5 py-3.5 text-sm last:border-b-0 hover:bg-white/[0.03]">
                  <span className={`c-chip w-20 justify-center ${
                    t.outcome === "WON" ? "border-emerald-300/40 bg-emerald-50 text-emerald-700"
                    : t.outcome === "LOST" ? "border-rose-300/40 bg-rose-50 text-rose-700"
                    : ""
                  }`}>
                    {t.outcome === "N/A" ? t.status : t.outcome}
                  </span>
                  <span className="c-mono min-w-0 flex-1 basis-40 truncate text-xs text-[var(--c-dim)]">{t.marketSlug}</span>
                  <span className={`c-mono text-xs font-semibold ${t.direction === "UP" ? "text-[var(--c-up)]" : "text-[var(--c-down)]"}`}>{t.direction}</span>
                  <span className="c-mono text-xs text-[var(--c-dim)]">${t.amountUsd.toFixed(2)} @ {(t.price * 100).toFixed(0)}¢</span>
                  {t.pnlUsd != null && (
                    <span className={`c-mono text-xs font-semibold ${t.pnlUsd >= 0 ? "text-[var(--c-up)]" : "text-[var(--c-down)]"}`}>
                      {t.pnlUsd >= 0 ? "+" : "−"}${Math.abs(t.pnlUsd).toFixed(2)}
                    </span>
                  )}
                  <span className={`c-chip ${t.paper ? "" : "border-amber-300/40 bg-amber-50 text-amber-700"}`}>{t.paper ? "practice" : "live"}</span>
                  <span className="ml-auto shrink-0 text-xs text-[var(--c-faint)]">{new Date(t.executedAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )
        )}

        {tab === "runs" && (
          <>
            {runsWarning && <p className="border-b border-white/10 bg-amber-50 px-5 py-2.5 text-xs text-amber-800">{runsWarning}</p>}
            {runs.length === 0 ? (
              <p className="px-6 py-14 text-center text-sm text-[var(--c-dim)]">No KeeperHub runs recorded yet.</p>
            ) : (
              <ul>
                {runs.map((r, i) => (
                  <li key={i} className="flex flex-wrap items-start gap-3 border-b border-white/5 px-5 py-3.5 text-sm last:border-b-0">
                    {r.kind === "TRADED" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--c-up)]" />}
                    {r.kind === "SAT_OUT" && <MinusCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--c-faint)]" />}
                    {r.kind === "FAILED" && <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--c-down)]" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-sm font-medium ${r.kind === "TRADED" ? "text-[var(--c-up)]" : r.kind === "FAILED" ? "text-[var(--c-down)]" : "text-[var(--c-dim)]"}`}>
                          {r.kind === "TRADED" ? "Traded" : r.kind === "SAT_OUT" ? "Sat out" : "Failed"}
                        </span>
                        {r.marketSlug && <span className="c-mono truncate text-xs text-[var(--c-faint)]">{r.marketSlug}</span>}
                        {r.direction && <span className="c-mono text-xs text-[var(--c-dim)]">{r.direction}</span>}
                      </div>
                      {r.reason && <p className="mt-0.5 text-xs text-[var(--c-dim)]">{r.reason}</p>}
                    </div>
                    {r.startedAt && <span className="shrink-0 text-xs text-[var(--c-faint)]">{new Date(r.startedAt).toLocaleString()}</span>}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="flex flex-col justify-between gap-3 text-xs text-[var(--c-faint)] sm:flex-row sm:items-center">
        <p className="flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          Win/loss and P&amp;L use Polymarket&rsquo;s published resolution, recalculated on every load.
        </p>
        <Link href="/wallet" className="inline-flex items-center gap-1 text-[var(--c-pink)] hover:underline">
          Manage balance and withdrawals <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </section>
  );
}
