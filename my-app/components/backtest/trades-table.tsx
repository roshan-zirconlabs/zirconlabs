"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight, CheckCircle, XCircle } from "lucide-react";

export interface TradeItem {
  id: string | number;
  tradeNum: number;
  timestamp: string;
  direction: "UP" | "DOWN";
  entryPrice: number;
  exitPrice?: number;
  pnl: number;
  pnlPct: number;
  isWin: boolean;
}

export default function TradesTable({ trades }: { trades: TradeItem[] }) {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.ceil(trades.length / pageSize) || 1;

  const currentTrades = trades.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="rounded-xl border border-neutral-800 bg-[#0c0d12] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800/80">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Strategy Executions ({trades.length.toLocaleString()})
        </h4>
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded border border-neutral-800 hover:bg-neutral-800 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 rounded border border-neutral-800 hover:bg-neutral-800 disabled:opacity-40"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#12141c] text-neutral-400 font-mono border-b border-neutral-800">
            <tr>
              <th className="py-2.5 px-4">Trade #</th>
              <th className="py-2.5 px-4">Time</th>
              <th className="py-2.5 px-4">Direction</th>
              <th className="py-2.5 px-4">Entry / Exit</th>
              <th className="py-2.5 px-4">Result</th>
              <th className="py-2.5 px-4 text-right">Net P&L</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/60 font-mono">
            {currentTrades.map((t, idx) => (
              <tr key={idx} className="hover:bg-neutral-900/40 transition-colors">
                <td className="py-2.5 px-4 text-neutral-400">#{t.tradeNum}</td>
                <td className="py-2.5 px-4 text-neutral-300">{t.timestamp}</td>
                <td className="py-2.5 px-4">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                      t.direction === "UP"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    }`}
                  >
                    {t.direction}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-neutral-300">
                  ${t.entryPrice.toLocaleString()} {t.exitPrice ? `→ $${t.exitPrice.toLocaleString()}` : ""}
                </td>
                <td className="py-2.5 px-4">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                      t.isWin ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {t.isWin ? (
                      <CheckCircle className="h-3.5 w-3.5" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" />
                    )}
                    {t.isWin ? "WIN" : "LOSS"}
                  </span>
                </td>
                <td
                  className={`py-2.5 px-4 text-right font-semibold ${
                    t.isWin ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)} ({t.pnlPct >= 0 ? "+" : ""}{t.pnlPct.toFixed(1)}%)
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
