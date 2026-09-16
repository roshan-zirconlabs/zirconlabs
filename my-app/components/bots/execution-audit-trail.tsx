"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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

function StatTile({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" | "neutral" }) {
  const toneClass = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-rose-700" : "text-slate-900";
  return (
    <div className="rounded-xl border border-purple-100 bg-white p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
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

  if (loading && !data) return <div className="h-72 animate-pulse rounded-2xl border border-purple-100 bg-white" />;
  if (error && !data) return <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>;
  if (!data) return null;

  const { stats, trades, runs, runsWarning } = data;
  const redeemableTrades = trades.filter(t => t.redeemable);

  return (
    <section className="space-y-4">
      {/* Stats: the "full analysis" — win rate, realized P&L, staked, split by mode */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Win rate" value={stats.winRate != null ? `${stats.winRate}%` : "—"} />
        <StatTile
          label="Realized P&L"
          value={`${stats.realizedPnlUsd >= 0 ? "+" : ""}$${stats.realizedPnlUsd.toFixed(2)}`}
          tone={stats.realizedPnlUsd > 0 ? "good" : stats.realizedPnlUsd < 0 ? "bad" : "neutral"}
        />
        <StatTile label="Staked so far" value={`$${stats.totalStakedUsd.toFixed(2)}`} />
        <StatTile label="Open positions" value={String(stats.open)} />
      </div>
      <p className="text-xs text-slate-500">
        {stats.wins} won · {stats.losses} lost · {stats.open} awaiting the market closing
        {stats.liveCount > 0 && stats.paperCount > 0 ? ` · ${stats.liveCount} live, ${stats.paperCount} practice` : stats.liveCount > 0 ? " · live" : " · practice only"}
      </p>

      {/* Claim winnings, surfaced right where the trades that earned them are */}
      {redeemableTrades.length > 0 && (
        <div className="space-y-2">
          {redeemableTrades.map(t => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
              <span className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  <span className="block font-medium text-slate-900">{t.marketSlug} won</span>
                  <span className="block text-xs text-slate-500">+${t.pnlUsd?.toFixed(2)} to claim</span>
                </span>
              </span>
              <button onClick={() => void claim(t)} disabled={claiming !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50">
                {claiming === t.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Claim
              </button>
            </div>
          ))}
        </div>
      )}

      {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
      {error && data && <p role="alert" className="text-sm text-rose-700">{error}</p>}

      {/* Two views on the same history: trades taken, and every run including sat-outs/failures */}
      <div className="rounded-2xl border border-purple-100 bg-white shadow-xs">
        <div className="flex items-center justify-between border-b border-purple-100 px-4 py-2.5">
          <div className="flex gap-1">
            <button onClick={() => setTab("trades")} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === "trades" ? "bg-purple-50 text-purple-700" : "text-slate-500 hover:text-slate-800"}`}>
              Trades ({trades.length})
            </button>
            <button onClick={() => setTab("runs")} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === "runs" ? "bg-purple-50 text-purple-700" : "text-slate-500 hover:text-slate-800"}`}>
              Every run ({runs.length})
            </button>
          </div>
          <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-purple-50 disabled:opacity-50">
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {tab === "trades" && (
          trades.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">No trades yet. They&rsquo;ll appear here as soon as the bot runs and the rule fires.</p>
          ) : (
            <div className="divide-y divide-purple-50">
              {trades.map(t => (
                <div key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <span className={`inline-flex h-6 w-16 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                    t.outcome === "WON" ? "bg-emerald-100 text-emerald-700"
                    : t.outcome === "LOST" ? "bg-rose-100 text-rose-700"
                    : "bg-slate-100 text-slate-500"
                  }`}>
                    {t.outcome === "N/A" ? t.status : t.outcome}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-700">{t.marketSlug}</span>
                  <span className={`text-xs font-semibold ${t.direction === "UP" ? "text-emerald-700" : "text-rose-700"}`}>{t.direction}</span>
                  <span className="text-xs tabular-nums text-slate-500">${t.amountUsd.toFixed(2)} @ {(t.price * 100).toFixed(0)}¢</span>
                  {t.pnlUsd != null && (
                    <span className={`text-xs font-semibold tabular-nums ${t.pnlUsd >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {t.pnlUsd >= 0 ? "+" : ""}${t.pnlUsd.toFixed(2)}
                    </span>
                  )}
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${t.paper ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-700"}`}>
                    {t.paper ? "practice" : "live"}
                  </span>
                  <span className="ml-auto shrink-0 text-[11px] text-slate-400">{new Date(t.executedAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )
        )}

        {tab === "runs" && (
          <>
            {runsWarning && <p className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-800">{runsWarning}</p>}
            {runs.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">No KeeperHub runs recorded yet.</p>
            ) : (
              <div className="divide-y divide-purple-50">
                {runs.map((r, i) => (
                  <div key={i} className="flex flex-wrap items-start gap-3 px-4 py-3 text-sm">
                    {r.kind === "TRADED" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
                    {r.kind === "SAT_OUT" && <MinusCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}
                    {r.kind === "FAILED" && <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-xs font-semibold ${r.kind === "TRADED" ? "text-emerald-700" : r.kind === "FAILED" ? "text-rose-700" : "text-slate-500"}`}>
                          {r.kind === "TRADED" ? "Traded" : r.kind === "SAT_OUT" ? "Sat out" : "Failed"}
                        </span>
                        {r.marketSlug && <span className="truncate font-mono text-xs text-slate-500">{r.marketSlug}</span>}
                        {r.direction && <span className="text-xs font-medium text-slate-600">{r.direction}</span>}
                      </div>
                      {r.reason && <p className="mt-0.5 text-xs text-slate-500">{r.reason}</p>}
                    </div>
                    {r.startedAt && <span className="shrink-0 text-[11px] text-slate-400">{new Date(r.startedAt).toLocaleString()}</span>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <p className="flex items-center gap-1.5 text-xs text-slate-400">
        <AlertCircle className="h-3 w-3" />
        Win/loss and P&L are computed from Polymarket&rsquo;s published resolution for each market — recalculated on every load, not stored guesses.
      </p>
      <Link href="/wallet" className="inline-flex items-center gap-1 text-xs text-purple-700 underline">
        Manage balance and withdrawals <ExternalLink className="h-3 w-3" />
      </Link>
    </section>
  );
}
