"use client";

import React from "react";
import { TrendingUp, TrendingDown, Target, Percent, Activity, Scale } from "lucide-react";

export interface PerformanceMetrics {
  totalTrades: number;
  winRate: number; // 0 to 1
  totalPnl: number;
  totalRoiPct: number;
  profitFactor: number;
  maxDrawdownPct: number;
  avgWin: number;
  avgLoss: number;
  wins: number;
  losses: number;
}

export default function PerformanceSummary({
  metrics,
}: {
  metrics: PerformanceMetrics;
}) {
  const isProfitable = metrics.totalPnl >= 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* Total PnL */}
      <div className="rounded-xl border border-neutral-800 bg-[#0c0d12] p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span>Net Return</span>
          {isProfitable ? (
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          ) : (
            <TrendingDown className="h-4 w-4 text-rose-400" />
          )}
        </div>
        <div className="mt-2">
          <div
            className={`text-xl font-bold font-mono tracking-tight ${
              isProfitable ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {isProfitable ? "+" : ""}${metrics.totalPnl.toFixed(2)}
          </div>
          <div
            className={`text-xs font-mono mt-0.5 ${
              isProfitable ? "text-emerald-500/80" : "text-rose-500/80"
            }`}
          >
            {isProfitable ? "+" : ""}{metrics.totalRoiPct.toFixed(1)}% ROI
          </div>
        </div>
      </div>

      {/* Win Rate */}
      <div className="rounded-xl border border-neutral-800 bg-[#0c0d12] p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span>Win Rate</span>
          <Percent className="h-4 w-4 text-cyan-400" />
        </div>
        <div className="mt-2">
          <div className="text-xl font-bold font-mono text-neutral-100">
            {(metrics.winRate * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-neutral-500 mt-0.5 font-mono">
            {metrics.wins}W / {metrics.losses}L
          </div>
        </div>
      </div>

      {/* Profit Factor */}
      <div className="rounded-xl border border-neutral-800 bg-[#0c0d12] p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span>Profit Factor</span>
          <Scale className="h-4 w-4 text-amber-400" />
        </div>
        <div className="mt-2">
          <div className="text-xl font-bold font-mono text-neutral-100">
            {metrics.profitFactor > 50 ? "50.0+" : metrics.profitFactor.toFixed(2)}
          </div>
          <div className="text-xs text-neutral-500 mt-0.5">
            {metrics.profitFactor >= 1.5 ? "High conviction" : "Balanced"}
          </div>
        </div>
      </div>

      {/* Max Drawdown */}
      <div className="rounded-xl border border-neutral-800 bg-[#0c0d12] p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span>Max Drawdown</span>
          <Activity className="h-4 w-4 text-rose-400" />
        </div>
        <div className="mt-2">
          <div className="text-xl font-bold font-mono text-rose-400">
            -{metrics.maxDrawdownPct.toFixed(1)}%
          </div>
          <div className="text-xs text-neutral-500 mt-0.5">Peak-to-trough</div>
        </div>
      </div>

      {/* Total Trades */}
      <div className="rounded-xl border border-neutral-800 bg-[#0c0d12] p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span>Executed Trades</span>
          <Target className="h-4 w-4 text-purple-400" />
        </div>
        <div className="mt-2">
          <div className="text-xl font-bold font-mono text-neutral-100">
            {metrics.totalTrades.toLocaleString()}
          </div>
          <div className="text-xs text-neutral-500 mt-0.5">Signals analyzed</div>
        </div>
      </div>

      {/* Payoff Ratio */}
      <div className="rounded-xl border border-neutral-800 bg-[#0c0d12] p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span>Avg Win / Loss</span>
          <Scale className="h-4 w-4 text-neutral-400" />
        </div>
        <div className="mt-2">
          <div className="text-xl font-bold font-mono text-neutral-100">
            ${metrics.avgWin.toFixed(1)} / ${Math.abs(metrics.avgLoss).toFixed(1)}
          </div>
          <div className="text-xs text-neutral-500 mt-0.5 font-mono">
            Ratio: {metrics.avgLoss !== 0 ? (metrics.avgWin / Math.abs(metrics.avgLoss)).toFixed(2) : "N/A"}
          </div>
        </div>
      </div>
    </div>
  );
}
