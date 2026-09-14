"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, CheckCircle, ArrowRight, Loader2, X, Zap } from "lucide-react";

interface DeployModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: "BTC" | "ETH";
  timeframe: string;
  stakeUsd: number;
}

export default function DeployModal({
  isOpen,
  onClose,
  asset,
  timeframe,
  stakeUsd,
}: DeployModalProps) {
  const router = useRouter();
  const [botName, setBotName] = useState(
    `${asset} ${timeframe} KeeperHub Strategy`,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDeploy = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: botName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create bot");
      }

      const bot = await res.json();
      router.push(`/bots/${bot.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to deploy strategy");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-neutral-800 bg-[#0e1017] p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-1 rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-neutral-100">
              Deploy as KeeperHub Bot
            </h3>
            <p className="text-xs text-neutral-400">
              Convert this backtested strategy into an active automation workflow
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-400">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
              Bot Name
            </label>
            <input
              type="text"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              className="w-full rounded-lg border border-neutral-800 bg-[#141722] px-3.5 py-2.5 text-xs text-neutral-100 focus:border-emerald-500/60 focus:outline-none"
            />
          </div>

          <div className="rounded-xl border border-neutral-800/80 bg-[#12141d] p-3 text-xs space-y-2 font-mono">
            <div className="flex items-center justify-between text-neutral-400">
              <span>Target Asset:</span>
              <span className="text-neutral-200">{asset} / USD</span>
            </div>
            <div className="flex items-center justify-between text-neutral-400">
              <span>Timeframe Window:</span>
              <span className="text-emerald-400">{timeframe} Up/Down</span>
            </div>
            <div className="flex items-center justify-between text-neutral-400">
              <span>Trade Stake:</span>
              <span className="text-neutral-200">${stakeUsd} USDC</span>
            </div>
            <div className="flex items-center justify-between text-neutral-400">
              <span>Safety Default:</span>
              <span className="text-emerald-400">Paper Trading Active</span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading || !botName.trim()}
              onClick={handleDeploy}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-black hover:bg-emerald-400 transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Provisioning Workflow...
                </>
              ) : (
                <>
                  Create & Open Editor
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
