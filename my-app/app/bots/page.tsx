"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Search, SlidersHorizontal } from "lucide-react";
import ActivationControl from "@/components/bots/activation-control";
import BotAvatar from "@/components/bots/bot-avatar";
import CreateBotDialog from "@/components/bots/create-bot-dialog";
import { BotStatusBadge, EmptyState, Notice, PageHeader, PageShell, StatusBadge } from "@/components/ui/page";
import Skeleton from "@/components/ui/skeleton";
import { describeBot, useBots } from "@/hooks/useBots";

type Filter = "all" | "running" | "paused";

export default function BotsPage() {
  const router = useRouter();
  const { bots, isLoading, error, patchBot, sessionStatus } = useBots();
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (sessionStatus === "unauthenticated") router.push("/auth/sign-in?callbackUrl=/bots");
  }, [sessionStatus, router]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bots.filter((b) => {
      if (filter === "running" && b.status !== "ACTIVE") return false;
      if (filter === "paused" && b.status === "ACTIVE") return false;
      return !q || b.name.toLowerCase().includes(q);
    });
  }, [bots, filter, query]);

  const loading = sessionStatus === "loading" || isLoading;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Fleet"
        title="Your"
        accent="bots."
        description="Each bot watches one signal and trades one kind of market, inside the limits you set."
        actions={
          <button type="button" onClick={() => setCreating(true)} className="c-btn-primary">
            <Plus className="h-4 w-4" /> New bot
          </button>
        }
      />

      {bots.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="c-tabs" role="group" aria-label="Filter bots">
            {(["all", "running", "paused"] as Filter[]).map((f) => (
              <button key={f} type="button" className="c-tab capitalize" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>
          <label className="relative block sm:w-72">
            <span className="sr-only">Search bots</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--c-faint)]" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name" className="c-input !rounded-full !pl-10" />
          </label>
        </div>
      )}

      {error ? (
        <Notice tone="error">{(error as Error).message}</Notice>
      ) : loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : bots.length === 0 ? (
        <EmptyState
          title="No bots in orbit yet"
          body="Name your first bot, choose what triggers it, and watch it trade with simulated money before anything real moves."
          action={
            <button type="button" onClick={() => setCreating(true)} className="c-btn-primary">
              <Plus className="h-4 w-4" /> Launch your first bot
            </button>
          }
        />
      ) : visible.length === 0 ? (
        <p className="c-panel p-10 text-center text-[var(--c-dim)]">No bots match that filter.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((b) => (
            <li key={b.id} className="c-panel c-panel-hover flex flex-col p-6">
              <div className="flex items-start justify-between gap-3">
                <BotAvatar id={b.id} active={b.status === "ACTIVE"} size="lg" />
                <div className="flex flex-wrap justify-end gap-2">
                  {b.strategy?.mode && (
                    <StatusBadge tone={b.strategy.mode === "live" ? "live" : "practice"}>{b.strategy.mode === "live" ? "Live" : "Practice"}</StatusBadge>
                  )}
                  <BotStatusBadge status={b.status} />
                </div>
              </div>
              <Link href={`/bots/${b.id}`} className="mt-5 block">
                <h2 className="c-serif truncate text-3xl text-white hover:underline">{b.name}</h2>
              </Link>
              <p className="c-mono mt-1 truncate text-xs text-[var(--c-faint)]">{describeBot(b)}</p>

              <dl className="mt-5 grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div>
                  <dt className="text-xs text-[var(--c-faint)]">Trades</dt>
                  <dd className="c-mono mt-1 text-lg">{(b._count?.trades ?? 0).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--c-faint)]">Created</dt>
                  <dd className="c-mono mt-1 text-lg">{new Date(b.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</dd>
                </div>
              </dl>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
                <ActivationControl botId={b.id} status={b.status} workflowId={b.keeperhubWorkflowId} compact onChanged={(next) => patchBot(b.id, next)} />
                <div className="flex items-center gap-1">
                  <Link href={`/bots/${b.id}/edit`} className="c-btn-ghost c-btn-sm" title="Open visual editor">
                    <SlidersHorizontal className="h-4 w-4" /> Edit
                  </Link>
                  <Link href={`/bots/${b.id}`} aria-label={`Open ${b.name}`} className="grid h-9 w-9 place-items-center rounded-full text-[var(--c-dim)] hover:bg-white/10 hover:text-white">
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CreateBotDialog open={creating} onClose={() => setCreating(false)} />
    </PageShell>
  );
}
