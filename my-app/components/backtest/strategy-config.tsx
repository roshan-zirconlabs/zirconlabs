"use client";

import React from "react";
import { Sliders, DollarSign, Clock, Shield } from "lucide-react";

export interface StrategyConfigValues {
  asset: "BTC" | "ETH";
  timeframe: "15m" | "1h" | "4h" | "1d";
  stakeUsd: number;
  marketType: "15m" | "1h" | "4h" | "1d" | "all";
  allowMultipleEntriesSameMarket: boolean;
}

interface StrategyConfigProps {
  config: StrategyConfigValues;
  onChange: (patch: Partial<StrategyConfigValues>) => void;
  disabled?: boolean;
}

export default function StrategyConfig({
  config,
  onChange,
  disabled,
}: StrategyConfigProps) {
  return (
    <div className="rounded-xl border border-neutral-800/80 bg-[#0c0d12] p-5">
      <div className="flex items-center gap-2 mb-4 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        <Sliders className="h-4 w-4 text-emerald-400" />
        Strategy & Polymarket Window Parameters
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Asset */}
        <div>
          <label className="block text-xs text-neutral-400 mb-1.5 font-medium">
            Underlying Asset
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(["BTC", "ETH"] as const).map((a) => (
              <button
                key={a}
                type="button"
                disabled={disabled}
                onClick={() => onChange({ asset: a })}
                className={`flex items-center justify-center rounded-lg border py-2 text-xs font-semibold transition ${
                  config.asset === a
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                    : "border-neutral-800 bg-[#12141a] text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {a} / USD
              </button>
            ))}
          </div>
        </div>

        {/* Timeframe */}
        <div>
          <label className="block text-xs text-neutral-400 mb-1.5 font-medium">
            Market Timeframe
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {(["15m", "1h", "4h", "1d"] as const).map((tf) => (
              <button
                key={tf}
                type="button"
                disabled={disabled}
                onClick={() => onChange({ timeframe: tf, marketType: tf })}
                className={`flex items-center justify-center rounded-lg border py-2 text-xs font-medium transition ${
                  config.timeframe === tf
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                    : "border-neutral-800 bg-[#12141a] text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Stake */}
        <div>
          <label className="block text-xs text-neutral-400 mb-1.5 font-medium">
            Stake per Trade (USDC)
          </label>
          <div className="relative">
            <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500" />
            <input
              type="number"
              min={1}
              max={10000}
              value={config.stakeUsd}
              disabled={disabled}
              onChange={(e) =>
                onChange({ stakeUsd: Math.max(1, Number(e.target.value) || 10) })
              }
              className="w-full rounded-lg border border-neutral-800 bg-[#12141a] py-2 pl-8 pr-3 text-xs text-neutral-100 placeholder-neutral-500 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/60"
            />
          </div>
        </div>

        {/* Binary Mode */}
        <div>
          <label className="block text-xs text-neutral-400 mb-1.5 font-medium">
            Polymarket Mode
          </label>
          <div className="flex items-center justify-between h-[38px] rounded-lg border border-neutral-800 bg-[#12141a] px-3">
            <span className="text-xs text-neutral-300 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-emerald-400" />
              Binary Match
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
