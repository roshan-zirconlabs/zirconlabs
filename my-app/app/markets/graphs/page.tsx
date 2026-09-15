"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS, LineElement, PointElement, LinearScale, TimeScale, Tooltip, Legend, Title, Filler,
} from "chart.js";
import "chartjs-adapter-date-fns";

ChartJS.register(LineElement, PointElement, LinearScale, TimeScale, Tooltip, Legend, Title, Filler);

type ActiveMarket = {
  slug: string;
  timeframe: "15m" | "1h" | "4h" | "1d";
  startTs: number;
  endTs: number;
  upPrice: number | null;
  downPrice: number | null;
  status: "active" | "upcoming" | "ended";
};

type History = { slug: string; question: string; outcome: string; history: { t: number; p: number }[] };

export default function MarketGraphsPage() {
  const [markets, setMarkets] = useState<ActiveMarket[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartError, setChartError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/markets", { cache: "no-store" });
        const json = await res.json();
        if (!alive) return;
        if (!res.ok) throw new Error(json.error || "Markets could not be loaded.");
        setMarkets(json.markets ?? []);
        setSelected(json.markets?.[0]?.slug ?? null);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Markets could not be loaded.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let alive = true;
    setHistory(null); setChartError(null);
    (async () => {
      try {
        const res = await fetch(`/api/markets/history?slug=${encodeURIComponent(selected)}`, { cache: "no-store" });
        const json = await res.json();
        if (!alive) return;
        if (!res.ok) throw new Error(json.error || "Price history could not be loaded.");
        setHistory(json);
      } catch (e) {
        if (alive) setChartError(e instanceof Error ? e.message : "Price history could not be loaded.");
      }
    })();
    return () => { alive = false; };
  }, [selected]);

  const chart = useMemo(() => {
    const points = history?.history ?? [];
    return {
      datasets: [{
        label: `${history?.outcome ?? "Up"} price`,
        data: points.map(p => ({ x: p.t * 1000, y: p.p })),
        borderColor: "#7c3aed",
        backgroundColor: "rgba(124,58,237,0.12)",
        borderWidth: 2, pointRadius: 0, fill: true, tension: 0.25,
      }],
    };
  }, [history]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-purple-100 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Market charts</h1>
          <p className="mt-1 text-sm text-slate-500">
            Live Polymarket up/down markets. The chart shows what the market has been charging for an “Up” share.
          </p>
        </div>
        <Link href="/markets" className="text-sm text-violet-700 underline">Back to markets</Link>
      </div>

      {error && <p role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[18rem_1fr]">
        <aside className="space-y-2">
          {loading
            ? [0, 1, 2].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-purple-50" />)
            : markets.length === 0 && !error
              ? <p className="text-sm text-slate-500">No open markets right now.</p>
              : markets.map(m => (
                  <button
                    key={m.slug}
                    onClick={() => setSelected(m.slug)}
                    aria-current={selected === m.slug}
                    className={`w-full rounded-xl border p-3 text-left transition ${selected === m.slug ? "border-purple-300 bg-purple-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                  >
                    <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {m.timeframe} · {m.status}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-xs text-slate-700">{m.slug}</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      Up {m.upPrice != null ? `${Math.round(m.upPrice * 100)}¢` : "—"} · Down {m.downPrice != null ? `${Math.round(m.downPrice * 100)}¢` : "—"}
                    </span>
                  </button>
                ))}
        </aside>

        <section className="rounded-2xl border border-purple-100 bg-white p-5">
          {chartError ? (
            <p role="alert" className="text-sm text-rose-700">{chartError}</p>
          ) : !history ? (
            <div className="h-80 animate-pulse rounded-xl bg-purple-50" />
          ) : (
            <>
              <h2 className="text-sm font-semibold text-slate-900">{history.question}</h2>
              <div className="mt-4 h-80">
                <Line
                  data={chart}
                  options={{
                    responsive: true, maintainAspectRatio: false,
                    scales: {
                      x: { type: "time", ticks: { maxTicksLimit: 8 } },
                      y: { min: 0, max: 1, ticks: { callback: v => `${Math.round(Number(v) * 100)}¢` } },
                    },
                    plugins: { legend: { display: false } },
                  }}
                />
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
