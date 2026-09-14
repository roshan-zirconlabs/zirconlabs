"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Bot, Plus, ArrowRight, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";

type BotItem = {
  id: string;
  name: string;
  status: string;
  keeperhubWorkflowId: string | null;
  editorUrl: string | null;
  webhookUrl: string | null;
  _count?: { trades: number };
};

export default function BotsPage() {
  const { status } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  const [bots, setBots] = useState<BotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") {
      if (status === "unauthenticated") router.push("/auth/sign-in");
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/bots");
        const json = await res.json();
        if (!alive) return;
        setBots(json.bots ?? []);
      } catch (e) {
        toast({
          variant: "error",
          title: "Failed to load bots",
          description: String(e),
        });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [status, toast, router]);

  async function createBot(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const res = await fetch("/api/bots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to create bot");
      }
      const id = json?.id || json?.bot?.id;
      if (!id) throw new Error("No bot ID returned");
      router.push(`/bots/${id}`);
    } catch (e: any) {
      toast({
        variant: "error",
        title: "Creation failed",
        description: e.message || String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-100/80 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Automated Bots
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Create a KeeperHub workflow, visually configure logic nodes, and monitor real execution telemetry.
          </p>
        </div>

        <form onSubmit={createBot} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="New bot name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-purple-400 focus:outline-none shadow-2xs"
          />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl cosmic-btn-primary px-4 py-2 text-xs font-semibold shadow-xs disabled:opacity-50 whitespace-nowrap"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create Bot
          </button>
        </form>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-44 rounded-xl border border-purple-100 bg-white animate-pulse shadow-xs"
            />
          ))}
        </div>
      ) : bots.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-purple-200 bg-white/70 p-12 text-center shadow-xs">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 border border-purple-200 text-purple-700 mb-3 shadow-2xs">
            <Bot className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">
            No bots yet
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Enter a bot name above to provision your first KeeperHub automation workflow.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bots.map((b) => (
            <div
              key={b.id}
              className="rounded-xl border border-purple-100 bg-white p-5 flex flex-col justify-between hover:border-purple-300 hover:shadow-md transition shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 border border-purple-200 text-purple-700 shadow-2xs">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        {b.name}
                      </h3>
                      <div className="text-[10px] font-mono text-slate-400">
                        ID: {b.id.slice(0, 10)}...
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                      b.status === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {b.status}
                  </span>
                </div>

                <div className="mt-4 text-xs font-mono bg-purple-50/40 p-2.5 rounded-lg border border-purple-100 flex items-center justify-between text-slate-500">
                  <span>Strategy Trades:</span>
                  <span className="text-slate-900 font-semibold">
                    {b._count?.trades ?? 0}
                  </span>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-purple-100 flex items-center justify-between gap-2">
                <Link
                  href={`/bots/${b.id}`}
                  className="text-xs text-slate-500 hover:text-purple-700 font-medium transition"
                >
                  View Details & Audit
                </Link>
                <Link
                  href={`/bots/${b.id}/edit`}
                  className="inline-flex items-center gap-1 rounded-lg bg-purple-50 border border-purple-200 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition shadow-2xs"
                >
                  Visual Editor
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
