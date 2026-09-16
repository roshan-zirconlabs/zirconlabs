"use client";

import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Tooltip,
  Filler,
  type ScriptableContext,
} from "chart.js";
import "chartjs-adapter-date-fns";
import { Notice, PageHeader, PageShell } from "@/components/ui/page";
import Skeleton from "@/components/ui/skeleton";

ChartJS.register(LineElement, PointElement, LinearScale, TimeScale, Tooltip, Filler);

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

const GRID = "rgba(255,255,255,0.06)";
const TICK = "rgba(226,220,255,0.55)";

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
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let alive = true;
    setHistory(null);
    setChartError(null);
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
    return () => {
      alive = false;
    };
  }, [selected]);

  const chart = useMemo(() => {
    const points = history?.history ?? [];
    return {
      datasets: [
        {
          label: `${history?.outcome ?? "Up"} price`,
          data: points.map((p) => ({ x: p.t * 1000, y: p.p })),
          borderColor: "#f7a8cf",
          backgroundColor: (ctx: ScriptableContext<"line">) => {
            const { chartArea, ctx: c } = ctx.chart;
            if (!chartArea) return "rgba(224,97,159,0.15)";
            const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            g.addColorStop(0, "rgba(224,97,159,0.35)");
            g.addColorStop(1, "rgba(146,119,245,0)");
            return g;
          },
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: true,
          tension: 0.25,
        },
      ],
    };
  }, [history]);

  const last = history?.history.at(-1)?.p;

  return (
    <PageShell>
      <PageHeader
        back={{ href: "/markets", label: "Live markets" }}
        eyebrow="Observatory"
        title="Market"
        accent="charts."
        description="What each open up/down market has been charging for an “Up” share over time."
      />

      {error && (
        <div className="mb-6">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside aria-label="Markets" className="space-y-2 lg:max-h-[70vh] lg:overflow-y-auto lg:pr-1">
          {loading ? (
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)
          ) : markets.length === 0 && !error ? (
            <p className="text-sm text-[var(--c-dim)]">No open markets right now.</p>
          ) : (
            markets.map((m) => (
              <button
                key={m.slug}
                onClick={() => setSelected(m.slug)}
                aria-current={selected === m.slug}
                className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                  selected === m.slug ? "border-[rgba(247,168,207,0.5)] bg-[rgba(224,97,159,0.1)]" : "border-white/10 bg-[rgba(14,16,48,0.6)] hover:border-white/25"
                }`}
              >
                <span className="c-eyebrow block !text-[10px]">
                  {m.timeframe} · {m.status}
                </span>
                <span className="c-mono mt-1.5 block truncate text-xs text-white">{m.slug}</span>
                <span className="c-mono mt-2 flex gap-3 text-xs">
                  <span className="text-[var(--c-up)]">Up {m.upPrice != null ? `${Math.round(m.upPrice * 100)}¢` : "—"}</span>
                  <span className="text-[var(--c-down)]">Down {m.downPrice != null ? `${Math.round(m.downPrice * 100)}¢` : "—"}</span>
                </span>
              </button>
            ))
          )}
        </aside>

        <section className="c-panel min-w-0 p-6">
          {chartError ? (
            <Notice tone="error">{chartError}</Notice>
          ) : !history ? (
            <Skeleton className="h-96" />
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h2 className="max-w-xl text-lg font-medium text-white">{history.question}</h2>
                {last != null && (
                  <p className="c-serif text-5xl leading-none">
                    <span className="c-nebula-text">{Math.round(last * 100)}¢</span>
                  </p>
                )}
              </div>
              <div className="mt-6 h-96">
                <Line
                  data={chart}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    interaction: { mode: "index", intersect: false },
                    scales: {
                      x: { type: "time", ticks: { maxTicksLimit: 8, color: TICK }, grid: { color: GRID }, border: { color: GRID } },
                      y: {
                        min: 0,
                        max: 1,
                        ticks: { color: TICK, callback: (v) => `${Math.round(Number(v) * 100)}¢` },
                        grid: { color: GRID },
                        border: { color: GRID },
                      },
                    },
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        backgroundColor: "rgba(10,12,36,0.95)",
                        borderColor: "rgba(255,255,255,0.12)",
                        borderWidth: 1,
                        padding: 10,
                        callbacks: { label: (c) => ` ${Math.round(Number(c.parsed.y) * 100)}¢` },
                      },
                    },
                  }}
                />
              </div>
            </>
          )}
        </section>
      </div>
    </PageShell>
  );
}
