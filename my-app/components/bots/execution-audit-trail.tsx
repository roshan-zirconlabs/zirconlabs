"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Play,
  RefreshCw,
  XCircle,
  FlaskConical,
  ShieldCheck,
  Zap,
} from "lucide-react";

type Execution = {
  id?: string;
  executionId?: string;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";
  startedAt?: string;
  durationMs?: number;
  error?: string;
  transactionHash?: string;
  txHash?: string;
  paper?: boolean;
  marketSlug?: string;
  side?: string;
  amount?: number;
  price?: number;
};

function statusIcon(status: Execution["status"]) {
  if (status === "SUCCESS") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === "FAILED" || status === "CANCELLED") return <XCircle className="h-4 w-4 text-rose-600" />;
  return <Loader2 className="h-4 w-4 animate-spin text-amber-600" />;
}

function statusColor(status: Execution["status"]) {
  if (status === "SUCCESS") return "text-emerald-700";
  if (status === "FAILED" || status === "CANCELLED") return "text-rose-700";
  return "text-amber-700";
}

export default function ExecutionAuditTrail({ botId }: { botId: string }) {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marketSlug, setMarketSlug] = useState("");
  const [sizeUsd, setSizeUsd] = useState("10");
  const [maxPrice, setMaxPrice] = useState("0.60");
  const [direction, setDirection] = useState("UP");

  const loadExecutions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/bots/${botId}/executions`, { cache: "no-store" });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok || !data || typeof data !== "object" || !("executions" in data) || !Array.isArray(data.executions)) {
        const message = data && typeof data === "object" && "error" in data ? String(data.error) : "Could not load execution records.";
        throw new Error(message);
      }
      setExecutions(data.executions as Execution[]);
      setError("warning" in data && data.warning ? String(data.warning) : null);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Could not load execution records.");
      setExecutions([]);
    } finally {
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    void loadExecutions();
  }, [loadExecutions]);

  const handleRun = async (paper: boolean) => {
    if (!paper && !confirm("Run the published KeeperHub workflow? Its configured actions may spend real funds from your organization wallet.")) return;
    setRunning(true);
    setError(null);
    try {
      const response = await fetch(`/api/bots/${botId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paper, confirmLive: !paper, ...(paper ? { order: { marketSlug, sizeUsd, maxPrice, direction } } : {}) }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data && typeof data === "object" && "error" in data ? String(data.error) : "Execution failed.";
        throw new Error(message);
      }
      await loadExecutions();
    } catch (runError: unknown) {
      setError(runError instanceof Error ? runError.message : "Failed to execute bot workflow.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-purple-100 bg-white p-5 shadow-xs" aria-live="polite">
      <div className="flex flex-col gap-3 border-b border-purple-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-purple-600" />
            <h2 className="text-sm font-semibold text-slate-900">Execution records</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            KeeperHub runs and separately labeled quote-time paper fills. A successful workflow is not proof of a settled trade.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadExecutions()}
            disabled={loading || running}
            className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-purple-50 disabled:opacity-50 transition shadow-xs cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void handleRun(true)}
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-50 transition shadow-xs cursor-pointer"
            title="Simulate workflow execution against live Polymarket prices without spending gas"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
            Test Paper Trade
          </button>
          <button
            type="button"
            onClick={() => void handleRun(false)}
            disabled={running}
            className="cosmic-btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 fill-white" />}
            Trigger Workflow
          </button>
        </div>
      </div>

      <fieldset className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-2">
        <legend className="px-2 text-sm font-medium">Paper quote — independent of workflow logic</legend>
        <label className="text-xs text-slate-600">Polymarket market slug<input value={marketSlug} onChange={e => setMarketSlug(e.target.value)} placeholder="Copy a market slug from Markets" className="mt-1 block w-full rounded-md border bg-white p-2 text-sm" /></label>
        <label className="text-xs text-slate-600">Outcome<select value={direction} onChange={e => setDirection(e.target.value)} className="mt-1 block w-full rounded-md border bg-white p-2 text-sm"><option value="UP">Yes / Up</option><option value="DOWN">No / Down</option></select></label>
        <label className="text-xs text-slate-600">Stake (USD)<input type="number" min="0.01" max="10000" step="0.01" value={sizeUsd} onChange={e => setSizeUsd(e.target.value)} className="mt-1 block w-full rounded-md border bg-white p-2 text-sm" /></label>
        <label className="text-xs text-slate-600">Maximum token price<input type="number" min="0.01" max="1" step="0.01" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} className="mt-1 block w-full rounded-md border bg-white p-2 text-sm" /></label>
      </fieldset>

      {error ? (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          {error}
        </p>
      ) : null}

      {loading ? <p className="text-xs text-slate-500">Loading verified execution records…</p> : null}

      {!loading && !error && executions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-purple-200 bg-purple-50/40 p-6 text-center text-xs text-slate-500">
          <FlaskConical className="mx-auto h-6 w-6 text-purple-400 mb-2" />
          No workflow runs recorded yet. Click <strong>&quot;Test Paper Trade&quot;</strong> to evaluate against live orderbook quotes.
        </div>
      ) : null}

      <div className="space-y-3">
        {executions.map((execution) => {
          const executionId = execution.executionId ?? execution.id ?? "Unknown run";
          const rawHash = execution.transactionHash ?? execution.txHash;
          const isValidTxHash =
            typeof rawHash === "string" && /^0x[a-fA-F0-9]{64}$/.test(rawHash);

          return (
            <article
              key={executionId}
              className="rounded-xl border border-purple-100 bg-purple-50/30 p-4 text-xs space-y-2 hover:border-purple-200 hover:bg-purple-50/60 transition shadow-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 font-semibold ${statusColor(execution.status)}`}>
                    {statusIcon(execution.status)}
                    {execution.status}
                  </span>

                  {execution.paper ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-mono font-semibold text-emerald-700">
                      PAPER SIMULATION
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-[10px] font-mono font-semibold text-purple-700">
                      ON-CHAIN KEEPER
                    </span>
                  )}
                </div>

                <span className="font-mono text-slate-400 text-[11px]">
                  {execution.durationMs ? `${execution.durationMs}ms` : executionId}
                </span>
              </div>

              {execution.marketSlug ? (
                <div className="flex flex-wrap items-center gap-3 text-slate-700 font-mono text-[11px] pt-1">
                  <span className="text-slate-400">Market:</span>
                  <span className="text-slate-900 font-semibold">{execution.marketSlug}</span>
                  {execution.side ? (
                    <span className={`font-semibold ${execution.side === "BUY" ? "text-emerald-700" : "text-rose-700"}`}>
                      {execution.side}
                    </span>
                  ) : null}
                  {execution.amount ? (
                    <span className="text-slate-800 font-semibold">${execution.amount.toFixed(2)}</span>
                  ) : null}
                  {execution.price ? (
                    <span className="text-slate-500">
                      @ {(execution.price * 100).toFixed(1)}¢
                    </span>
                  ) : null}
                </div>
              ) : null}

              {execution.startedAt ? (
                <p className="text-[11px] text-slate-500">
                  Triggered {new Date(execution.startedAt).toLocaleString()}
                </p>
              ) : null}

              {execution.error ? (
                <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2.5">
                  {execution.error}
                </p>
              ) : null}

              {isValidTxHash ? (
                <a
                  href={`https://polygonscan.com/tx/${rawHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-purple-700 font-medium underline underline-offset-2 hover:text-purple-900"
                >
                  View verified Polygonscan transaction <ExternalLink className="h-3 w-3" />
                </a>
              ) : execution.paper ? (
                <p className="text-[10px] text-slate-500 italic">
                  Non-custodial simulation filled at live Polymarket CLOB book depth. No on-chain gas spent.
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
