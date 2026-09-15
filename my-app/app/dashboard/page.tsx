"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Bot,
  Plus,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import ActivationControl from "@/components/bots/activation-control";

type BotItem = {
  id: string;
  name: string;
  status: string;
  keeperhubWorkflowId: string | null;
  editorUrl?: string | null;
  webhookUrl?: string | null;
  _count?: { trades: number };
  createdAt?: string;
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [bots, setBots] = useState<BotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newBotName, setNewBotName] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchBots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bots");
      const json = await res.json();
      setBots(json.bots ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user) fetchBots();
    else if (status === "unauthenticated") setLoading(false);
  }, [session, status, fetchBots]);

  const handleCreateBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBotName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newBotName.trim() }),
      });
      if (res.ok) {
        setNewBotName("");
        setShowCreateModal(false);
        await fetchBots();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create bot");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create bot");
    } finally {
      setCreating(false);
    }
  };

  if (status === "unauthenticated") {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 border border-purple-200 text-purple-700 mb-4 shadow-sm">
          <Bot className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">
          Sign in to Access Your Trading Bots
        </h1>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
          Manage your automated Polymarket strategies, run paper tests, and inspect verified execution records.
        </p>
        <Link
          href="/auth/sign-in"
          className="mt-6 inline-flex items-center gap-2 rounded-xl cosmic-btn-primary px-6 py-2.5 text-xs font-semibold shadow-md"
        >
          Sign In to Dashboard →
        </Link>
      </div>
    );
  }

  const activeBots = bots.filter((b) => b.status === "ACTIVE").length;
  const totalTrades = bots.reduce((acc, b) => acc + (b._count?.trades || 0), 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-100/80 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Bot Command Center
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Build and monitor deterministic Polymarket trading workflows powered by KeeperHub.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-xl cosmic-btn-primary px-4 py-2 text-xs font-semibold shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Create New Bot
          </button>
        </div>
      </div>

      {/* KPI Overview Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-purple-100 bg-white p-4 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Total Bots</div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1">
            {bots.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Automations configured</div>
        </div>

        <div className="rounded-xl border border-purple-100 bg-white p-4 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Active Workflows</div>
          <div className="text-xl font-bold font-mono text-violet-700 mt-1">
            {activeBots}
          </div>
          <div className="text-[11px] text-violet-600/80 mt-0.5">Scheduled on KeeperHub</div>
        </div>

        <div className="rounded-xl border border-purple-100 bg-white p-4 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Strategy Trades</div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1">
            {totalTrades.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Paper & verified executions</div>
        </div>

        <div className="rounded-xl border border-purple-100 bg-white p-4 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Execution Engine</div>
          <div className="text-xl font-bold font-mono text-purple-700 mt-1 flex items-center gap-1.5">
            <ShieldCheck className="h-5 w-5 text-violet-600" />
            Deterministic
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">KeeperHub v2 Core</div>
        </div>
      </div>

      {/* Bots Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Active Strategy Bots ({bots.length})
          </h2>
          <Link
            href="/bots"
            className="text-xs text-violet-700 hover:text-violet-800 font-medium transition flex items-center gap-1"
          >
            Manage all bots →
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-44 rounded-xl border border-purple-100 bg-white shadow-xs animate-pulse"
              />
            ))}
          </div>
        ) : bots.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-purple-200 bg-white/70 p-12 text-center shadow-xs">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 border border-purple-200 text-purple-700 mb-3">
              <Bot className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">
              No bots created yet
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Create your first bot to visually design and automate Polymarket trading strategies.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="rounded-xl cosmic-btn-primary px-4 py-2 text-xs font-semibold shadow-sm"
              >
                Create Bot
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bots.map((b) => {
              return (
                <div
                  key={b.id}
                  className="rounded-xl border border-purple-100/90 bg-white p-5 flex flex-col justify-between hover:border-purple-300 hover:shadow-md transition shadow-xs"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 border border-purple-200 text-purple-700 shadow-2xs">
                          <Bot className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">
                            {b.name}
                          </h3>
                          <div className="text-[11px] font-mono text-slate-400">
                            ID: {b.id.slice(0, 10)}...
                          </div>
                        </div>
                      </div>

                      <ActivationControl
                        botId={b.id}
                        status={b.status}
                        workflowId={b.keeperhubWorkflowId}
                        compact
                        onChanged={(next) => setBots((prev) => prev.map((item) => item.id === b.id ? { ...item, ...next } : item))}
                      />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-mono bg-purple-50/40 p-2.5 rounded-lg border border-purple-100">
                      <div>
                        <span className="text-slate-400 block text-[10px]">
                          Trades
                        </span>
                        <span className="text-slate-800 font-semibold">
                          {b._count?.trades ?? 0}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">
                          Engine
                        </span>
                        <span className="text-violet-700 font-semibold text-[11px]">
                          KeeperHub
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-purple-100 flex items-center justify-between gap-2">
                    <Link
                      href={`/bots/${b.id}`}
                      className="text-xs text-slate-500 hover:text-purple-700 transition font-medium"
                    >
                      View Details
                    </Link>
                    <Link
                      href={`/bots/${b.id}/edit`}
                      className="inline-flex items-center gap-1 rounded-lg bg-purple-50 border border-purple-200 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition"
                    >
                      Visual Editor
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Bot Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-purple-100 bg-white p-6 shadow-2xl shadow-purple-900/10">
            <h3 className="text-base font-semibold text-slate-900">
              Create a New Bot
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Zircon Labs will provision a real KeeperHub workflow and webhook URL for this bot.
            </p>

            <form onSubmit={handleCreateBot} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Bot Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. BTC 15m Momentum UpDown"
                  value={newBotName}
                  onChange={(e) => setNewBotName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-purple-400 focus:bg-white focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl px-4 py-2 text-xs text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newBotName.trim()}
                  className="rounded-xl cosmic-btn-primary px-4 py-2 text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create Bot"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
