"use client";
import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { BacktestReport, Market, MarketType } from "@/lib/backtest";
import dynamic from "next/dynamic";
import { FileJson, FileSpreadsheet, FlaskConical, Save } from "lucide-react";
import { Notice, PageHeader, PageShell, StatTile } from "@/components/ui/page";
import Skeleton from "@/components/ui/skeleton";
const EquityCurve = dynamic(() => import("@/components/backtest/equity-curve"), { ssr: false, loading: () => <Skeleton className="h-80" /> });
export default function BacktestPage() {
  const { status } = useSession();
  const [csv, setCsv] = useState(""); const [filename, setFilename] = useState("");
  const [markets, setMarkets] = useState<Market[]>([]); const [timeframe, setTimeframe] = useState<MarketType>("15m");
  const [stake, setStake] = useState("10"); const [report, setReport] = useState<BacktestReport | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load(file: File, kind: "csv" | "markets") {
    setError(""); setReport(null); setNotice("");
    if (file.size > 1000000) { setError("Use a file smaller than 1 MB."); return; }
    try {
      const text = await file.text();
      if (kind === "csv") { setCsv(text); setFilename(file.name); }
      else {
        const { marketHistorySchema } = await import("@/lib/backtest-input");
        const parsed = JSON.parse(text);
        setMarkets(marketHistorySchema.parse(Array.isArray(parsed) ? parsed : parsed.markets));
      }
    } catch { setError("Invalid file. Historical JSON needs slugs, Unix-second start/end times and yesTokenHistory.history arrays."); }
  }
  async function run(save: boolean) {
    setBusy(true); setError(""); setNotice("");
    try {
      const input = { tradesCsv: csv, markets, marketType: timeframe, stakeUsd: Number(stake) };
      const { backtestInput } = await import("@/lib/backtest-input");
      backtestInput.parse(input);
      if (save) {
        const res = await fetch("/api/backtest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, name: filename || "Backtest" }) });
        const data = await res.json(); if (!res.ok) throw new Error(data.error);
        setReport(data.report); setNotice("Backtest saved to your account.");
      } else {
        const { analyzeBacktest } = await import("@/lib/backtest");
        setReport(analyzeBacktest(input));
      }
    } catch (e) {
      const issue = (e as { issues?: { message: string }[] })?.issues?.[0]?.message;
      setError(issue ?? (e instanceof Error ? e.message : "Analysis failed."));
    }
    finally { setBusy(false); }
  }
  const metrics = report?.csvAnalysis;
  async function loadSample() {
    setBusy(true);
    try {
      const res = await fetch("/sample-strategy.csv");
      if (!res.ok) throw new Error("Sample unavailable");
      setCsv(await res.text()); setFilename("Sample strategy"); setReport(null);
    } catch { setError("Sample unavailable."); }
    finally { setBusy(false); }
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Backtest"
        title="Flight"
        accent="simulator."
        description="Replay exported trades and compare your signals against historical prediction-market prices. Uploaded data isn't independently verified, and past returns don't predict future results."
      />

      <section className="c-panel p-6 sm:p-8">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-5 w-5 text-[var(--c-pink)]" />
              <label htmlFor="signals-csv" className="font-medium text-white">TradingView or signal CSV</label>
            </div>
            <input id="signals-csv" type="file" accept=".csv,text/csv" disabled={busy} onChange={e => { if (e.target.files?.[0]) void load(e.target.files[0], "csv"); }} className="c-input mt-4" />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-[var(--c-faint)]">{filename ? <span className="text-[var(--c-up)]">Loaded: {filename}</span> : "Up to 1 MB and 5,000 lines. UTC timestamps."}</p>
              <button disabled={busy} className="text-sm text-[var(--c-pink)] hover:underline" onClick={() => void loadSample()}>Load sample CSV</button>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
            <div className="flex items-center gap-3">
              <FileJson className="h-5 w-5 text-[var(--c-pink)]" />
              <label htmlFor="market-history" className="font-medium text-white">Historical market JSON <span className="text-[var(--c-faint)]">(optional)</span></label>
            </div>
            <input id="market-history" type="file" accept=".json,application/json" disabled={busy} onChange={e => { if (e.target.files?.[0]) void load(e.target.files[0], "markets"); }} className="c-input mt-4" />
            <p className="mt-3 text-xs leading-relaxed text-[var(--c-faint)]">{markets.length} markets loaded. Without history, only CSV trade metrics are analyzed.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <label className="block">
            <span className="c-label">Market window</span>
            <select value={timeframe} onChange={e => { setTimeframe(e.target.value as MarketType); setReport(null); }} className="c-input">
              {["15m", "1h", "4h", "1d", "all"].map(t => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="c-label">Simulated stake per matched signal (USD)</span>
            <input type="number" min="0.01" max="10000" step="0.01" value={stake} onChange={e => { setStake(e.target.value); setReport(null); }} className="c-input" />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-6">
          <button onClick={() => run(false)} disabled={busy || !csv} className="c-btn-primary">
            <FlaskConical className="h-4 w-4" /> {busy ? "Analyzing…" : "Analyze locally"}
          </button>
          {status === "authenticated" && (
            <button onClick={() => run(true)} disabled={busy || !csv} className="c-btn-ghost">
              <Save className="h-4 w-4" /> Analyze and save
            </button>
          )}
        </div>
      </section>

      <div className="mt-5 space-y-3">
        {error && <Notice tone="error">{error}</Notice>}
        {notice && <Notice tone="success">{notice}</Notice>}
      </div>

      {report && (
        <div className="c-fade-in mt-8 space-y-6">
          <section>
            <h2 className="c-serif text-4xl text-white">CSV trade results</h2>
            {metrics ? (
              <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatTile label="Closed trades" value={metrics.trades} />
                <StatTile label="Win rate" value={`${(metrics.winRate * 100).toFixed(1)}%`} tone="accent" />
                <StatTile label="Reported P&L" value={metrics.totalPnl.toFixed(2)} tone={metrics.totalPnl >= 0 ? "good" : "bad"} />
                <StatTile label="Max drawdown" value={metrics.maxDrawdown.toFixed(2)} />
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--c-dim)]">No paired closed trades with P&amp;L found. Parsed {report.signalCount} directional signals.</p>
            )}
          </section>

          <section className="c-panel p-6 sm:p-8">
            <h2 className="c-serif text-4xl text-white">Polymarket comparison</h2>
            <p className="mt-2 text-sm text-[var(--c-dim)]">
              {report.summary.trades} matched trades from {report.signalCount} signals · {report.marketsCoverage.withHistory} markets with history.
              {report.fallbackUsed ? " The selected timeframe had no matches, so all available timeframes were used." : ""}
            </p>
            {report.matched.length > 0 ? (
              <>
                <p className="mt-3 text-sm text-white">
                  Simulated P&amp;L: <span className={report.summary.totalPnlUsd >= 0 ? "text-[var(--c-up)]" : "text-[var(--c-down)]"}>{report.summary.totalPnlUsd.toFixed(2)} USD</span>
                  <span className="text-[var(--c-faint)]"> · excludes fees, slippage and executable depth</span>
                </p>
                <div className="mt-6">
                  <EquityCurve stakeUsd={Number(stake)} data={report.matched.map((t, i) => ({ index: i, tradeNum: i + 1, dt: new Date(t.dtUtc * 1000).toISOString(), pnl: t.tokenPnl * Number(stake), cumulativePnl: report.equity[i] * Number(stake), isWin: t.result === "WIN" }))} />
                </div>
              </>
            ) : (
              <div className="mt-4"><Notice tone="warning">No historical matches. Import history covering the signals — zero coverage is not a zero-return strategy.</Notice></div>
            )}
          </section>

          <Link href="/bots" className="c-btn-ghost">Build a bot from this research →</Link>
        </div>
      )}
    </PageShell>
  );
}
