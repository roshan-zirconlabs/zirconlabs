"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Clock, RefreshCw, Zap, TrendingUp, TrendingDown, ExternalLink, ShieldCheck } from "lucide-react";

type BtcMarket = {
  slug: string;
  timeframe: string;
  startTs: number;
  endTs: number;
  upTokenId: string;
  downTokenId: string;
  upPrice: number | null;
  downPrice: number | null;
  status: "active" | "upcoming" | "ended";
  timeLeftSec: number;
};

const TF_LABELS: Record<string, string> = {
  "15m": "15 Minute",
  "1h": "1 Hour",
  "4h": "4 Hour",
  "1d": "Daily",
};

function formatTimeLeft(sec: number): string {
  if (sec <= 0) return "Resolving";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function MarketsPage() {
  const [markets, setMarkets] = useState<BtcMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const fetchMarkets = useCallback(async () => {
    try {
      const res = await fetch("/api/markets", { cache: "no-store" });
      const json = await res.json();
      if (json.markets?.length > 0) {
        setMarkets(json.markets);
        setError(null);
      } else if (json.error) {
        setError(json.error);
      } else {
        setMarkets([]);
      }
    } catch {
      setError("Failed to connect to Polymarket API");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
    const interval = setInterval(fetchMarkets, 30_000);
    return () => clearInterval(interval);
  }, [fetchMarkets]);

  // 1-second interval for real-time countdown
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const nowSec = Math.floor(Date.now() / 1000);
  const processedMarkets = markets.map((m) => {
    const timeLeft = Math.max(0, m.endTs - nowSec);
    const status: "active" | "upcoming" | "ended" =
      timeLeft > 0 && m.startTs <= nowSec
        ? "active"
        : m.startTs > nowSec
        ? "upcoming"
        : "ended";
    return { ...m, timeLeftSec: timeLeft, status };
  });

  const filtered =
    filter === "all"
      ? processedMarkets
      : processedMarkets.filter((m) => m.timeframe === filter);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-100 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-xs font-mono mb-2 shadow-2xs">
            <ShieldCheck className="h-3.5 w-3.5" />
            Polymarket Gamma & CLOB Feed
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Active Prediction Markets
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time auto-rotating BTC up/down binary contracts with live odds and orderbook liquidity.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setLoading(true);
            fetchMarkets();
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-purple-50 hover:border-purple-300 transition shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-purple-600 ${loading ? "animate-spin" : ""}`} />
          Refresh Markets
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-purple-100 pb-3">
        {["all", "15m", "1h", "4h", "1d"].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
              filter === f
                ? "bg-purple-50 text-purple-700 border border-purple-200 font-semibold shadow-2xs"
                : "text-slate-500 hover:text-slate-900 hover:bg-purple-50/50"
            }`}
          >
            {f === "all" ? "All Windows" : TF_LABELS[f] || f}
          </button>
        ))}
      </div>

      {/* Markets Grid */}
      {loading && markets.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-56 rounded-2xl border border-purple-100 bg-white animate-pulse shadow-xs"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-purple-100 bg-white p-12 text-center shadow-xs">
          <p className="text-sm text-slate-500">
            No active markets currently found for this filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => {
            const upP = m.upPrice !== null ? m.upPrice : 0.5;
            const downP = m.downPrice !== null ? m.downPrice : 0.5;
            const upPct = Math.round(upP * 100);
            const downPct = Math.round(downP * 100);

            return (
              <div
                key={m.slug}
                className="rounded-2xl border border-purple-100 bg-white p-5 flex flex-col justify-between hover:border-purple-300 hover:shadow-md transition shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                      BTC {m.timeframe.toUpperCase()}
                    </span>
                    <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                      <Clock className="h-3 w-3 text-purple-500" />
                      {formatTimeLeft(m.timeLeftSec)}
                    </div>
                  </div>

                  <h3 className="mt-3 text-sm font-semibold text-slate-900 line-clamp-1 font-mono">
                    {m.slug}
                  </h3>

                  {/* Odds Display */}
                  <div className="mt-4 grid grid-cols-2 gap-2 font-mono">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-2.5">
                      <div className="flex items-center justify-between text-[10px] text-emerald-700">
                        <span className="font-semibold">UP / YES</span>
                        <TrendingUp className="h-3 w-3 text-emerald-600" />
                      </div>
                      <div className="text-lg font-bold text-emerald-700 mt-0.5">
                        {upPct}¢
                      </div>
                      <div className="text-[10px] text-emerald-600/80">
                        {(upP * 100).toFixed(1)}% prob
                      </div>
                    </div>

                    <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-2.5">
                      <div className="flex items-center justify-between text-[10px] text-rose-700">
                        <span className="font-semibold">DOWN / NO</span>
                        <TrendingDown className="h-3 w-3 text-rose-600" />
                      </div>
                      <div className="text-lg font-bold text-rose-700 mt-0.5">
                        {downPct}¢
                      </div>
                      <div className="text-[10px] text-rose-600/80">
                        {(downP * 100).toFixed(1)}% prob
                      </div>
                    </div>
                  </div>

                  {/* Probability Bar */}
                  <div className="mt-3">
                    <div className="h-1.5 w-full rounded-full bg-rose-200 overflow-hidden flex">
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${upPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-purple-100 flex items-center justify-between gap-2">
                  <a
                    href={`https://polymarket.com/market/${m.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-slate-500 hover:text-purple-700 transition flex items-center gap-1"
                  >
                    View on Polymarket
                    <ExternalLink className="h-3 w-3 text-purple-500" />
                  </a>

                  <Link
                    href={`/bots`}
                    className="inline-flex items-center gap-1 rounded-xl bg-purple-50 border border-purple-200 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition shadow-2xs"
                  >
                    <Zap className="h-3 w-3 text-purple-600" />
                    Automate
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
