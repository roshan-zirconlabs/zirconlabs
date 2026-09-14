"use client";
import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { BacktestReport, Market, MarketType } from "@/lib/backtest";
import dynamic from "next/dynamic";
const EquityCurve = dynamic(() => import("@/components/backtest/equity-curve"), { ssr: false });
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
    } catch (e) { setError(e instanceof Error ? e.message : "Analysis failed."); }
    finally { setBusy(false); }
  }
  const metrics = report?.csvAnalysis;
  return <main className="mx-auto max-w-6xl space-y-8 px-5 py-10">
    <div><h1 className="text-3xl font-semibold tracking-tight">Backtest</h1><p className="mt-3 max-w-2xl text-slate-600">Inspect exported trades and compare signals with historical prediction-market prices. Uploaded data is not independently verified. Past returns do not predict future results.</p></div>
    <section className="grid gap-6 rounded-lg border border-slate-200 bg-white p-6 md:grid-cols-2">
      <div className="space-y-3"><label htmlFor="signals-csv" className="block font-medium">TradingView or signal CSV</label><input id="signals-csv" type="file" accept=".csv,text/csv" disabled={busy} onChange={e => { if (e.target.files?.[0]) void load(e.target.files[0], "csv"); }} className="block w-full text-sm" /><p className="text-xs text-slate-500">{filename || "Up to 1 MB and 5,000 lines. Use UTC timestamps."}</p><button disabled={busy} className="text-sm text-violet-700 underline" onClick={async () => { setBusy(true); try { const res = await fetch("/sample-strategy.csv"); if (!res.ok) throw new Error("Sample unavailable"); setCsv(await res.text()); setFilename("Sample strategy"); setReport(null); } catch { setError("Sample unavailable."); } finally { setBusy(false); } }}>Load sample CSV</button></div>
      <div className="space-y-3"><label htmlFor="market-history" className="block font-medium">Historical market JSON (optional)</label><input id="market-history" type="file" accept=".json,application/json" disabled={busy} onChange={e => { if (e.target.files?.[0]) void load(e.target.files[0], "markets"); }} className="block w-full text-sm" /><p className="text-xs leading-5 text-slate-500">{markets.length} markets loaded. Without history, only CSV trade metrics are analyzed. No Polymarket returns are inferred.</p></div>
      <label className="text-sm">Market window<select value={timeframe} onChange={e => { setTimeframe(e.target.value as MarketType); setReport(null); }} className="mt-2 block w-full rounded-lg border bg-white p-3">{["15m", "1h", "4h", "1d", "all"].map(t => <option key={t}>{t}</option>)}</select></label>
      <label className="text-sm">Simulated stake per matched signal (USD)<input type="number" min="0.01" max="10000" step="0.01" value={stake} onChange={e => { setStake(e.target.value); setReport(null); }} className="mt-2 block w-full rounded-lg border bg-white p-3" /></label>
      <div className="flex flex-wrap gap-3"><button onClick={() => run(false)} disabled={busy || !csv} className="cosmic-btn-primary px-5 py-3 text-sm disabled:opacity-50">{busy ? "Analyzing…" : "Analyze locally"}</button>{status === "authenticated" && <button onClick={() => run(true)} disabled={busy || !csv} className="rounded-lg border px-5 py-3 text-sm disabled:opacity-50">Analyze and save</button>}</div>
    </section>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}{notice && <p role="status" className="text-sm text-violet-700">{notice}</p>}
    {report && <div className="space-y-7">
      <section><h2 className="text-lg font-semibold">CSV trade results</h2>{metrics ? <dl className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-4">{[["Closed trades", metrics.trades], ["Win rate", (metrics.winRate * 100).toFixed(1) + "%"], ["Reported P&L", metrics.totalPnl.toFixed(2)], ["Max drawdown", metrics.maxDrawdown.toFixed(2)]].map(([name, value]) => <div key={name}><dt className="text-sm text-slate-500">{name}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd></div>)}</dl> : <p className="mt-3 text-sm text-slate-600">No paired closed trades with P&L found. Parsed {report.signalCount} directional signals.</p>}</section>
      <section className="border-t border-slate-200 pt-6"><h2 className="text-lg font-semibold">Historical Polymarket comparison</h2><p className="mt-3 text-sm text-slate-600">{report.summary.trades} matched trades from {report.signalCount} signals. {report.marketsCoverage.withHistory} markets with history. {report.fallbackUsed ? "The selected timeframe had no matches; all available timeframes were used." : ""}</p>
        {report.matched.length > 0 ? <><p className="mt-3 text-sm">Simulated P&L: {report.summary.totalPnlUsd.toFixed(2)} USD. Excludes fees, slippage and executable depth.</p><div className="mt-5"><EquityCurve stakeUsd={Number(stake)} data={report.matched.map((t, i) => ({ index: i, tradeNum: i + 1, dt: new Date(t.dtUtc * 1000).toISOString(), pnl: t.tokenPnl * Number(stake), cumulativePnl: report.equity[i] * Number(stake), isWin: t.result === "WIN" }))} /></div></> : <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">No historical matches. Import history covering the signals; zero coverage is not a zero-return strategy.</p>}
      </section><Link href="/bots" className="inline-block text-sm text-violet-700 underline">Build a workflow from your research</Link>
    </div>}
  </main>;
}
