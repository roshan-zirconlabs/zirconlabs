"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  Activity,
  ArrowRight,
  Bot,
  Cable,
  Check,
  ChartLine,
  FlaskConical,
  Plus,
  SlidersHorizontal,
  Telescope,
  Wallet,
} from "lucide-react";
import ActivationControl from "@/components/bots/activation-control";
import BotAvatar from "@/components/bots/bot-avatar";
import CreateBotDialog from "@/components/bots/create-bot-dialog";
import { BotStatusBadge, EmptyState, Notice, PageHeader, PageShell, StatTile, StatusBadge } from "@/components/ui/page";
import Skeleton from "@/components/ui/skeleton";
import { describeBot, useBots, useWalletSummary } from "@/hooks/useBots";

const SHORTCUTS = [
  { href: "/backtest", label: "Backtest a strategy", icon: FlaskConical },
  { href: "/markets/graphs", label: "Market charts", icon: ChartLine },
  { href: "/trade", label: "Place a trade", icon: Telescope },
  { href: "/connections", label: "Connections", icon: Cable },
];

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="ring-g" x1="0" x2="1">
            <stop offset="0" stopColor="#9277f5" />
            <stop offset="1" stopColor="#f7a8cf" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="url(#ring-g)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - done / total)}
          style={{ transition: "stroke-dashoffset .6s ease" }}
        />
      </svg>
      <span className="c-mono absolute inset-0 grid place-items-center text-sm">
        {done}/{total}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const { bots, isLoading, error, patchBot } = useBots();
  const wallet = useWalletSummary();
  const [creating, setCreating] = useState(false);

  if (status === "unauthenticated") {
    return (
      <PageShell width="narrow">
        <EmptyState
          title="Mission control awaits"
          body="Sign in to build bots, watch them trade in practice mode, and review every fill."
          action={
            <Link href="/auth/sign-in?callbackUrl=/dashboard" className="c-btn-primary">
              Sign in <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
      </PageShell>
    );
  }

  const running = bots.filter((b) => b.status === "ACTIVE").length;
  const trades = bots.reduce((sum, b) => sum + (b._count?.trades ?? 0), 0);
  const w = wallet.data;
  const firstName = session?.user?.name?.split(" ")[0];
  const loading = status === "loading" || isLoading;

  const checklist = [
    { label: "Create your first bot", done: bots.length > 0, href: "/bots" },
    { label: "Switch a bot on", done: running > 0, href: bots[0] ? `/bots/${bots[0].id}` : "/bots" },
    { label: "Open a trading wallet", done: Boolean(w?.hasAccount), href: "/wallet" },
    { label: "Fund the wallet", done: (w?.balance ?? 0) > 0, href: "/wallet" },
    { label: "Enable live trading", done: Boolean(w?.liveEnabled), href: "/wallet" },
  ];
  const doneCount = checklist.filter((c) => c.done).length;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Mission control"
        title={firstName ? "Welcome back," : "Mission"}
        accent={firstName ? `${firstName}.` : "control."}
        description="Every bot, every run and your wallet — at a glance."
        actions={
          <>
            <Link href="/markets" className="c-btn-ghost">
              Browse markets
            </Link>
            <button type="button" onClick={() => setCreating(true)} className="c-btn-primary">
              <Plus className="h-4 w-4" /> New bot
            </button>
          </>
        }
      />

      <section aria-label="Overview" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Bots" icon={Bot} value={loading ? "—" : bots.length} hint={loading ? " " : `${running} running now`} />
        <StatTile label="Running" icon={Activity} tone="accent" value={loading ? "—" : running} hint="Published on KeeperHub" />
        <StatTile label="Trades recorded" icon={ChartLine} value={loading ? "—" : trades.toLocaleString()} hint="Practice and live" />
        <StatTile
          label="Wallet balance"
          icon={Wallet}
          value={w?.balance != null ? `$${w.balance.toFixed(2)}` : "—"}
          hint={
            wallet.isLoading ? " " : !w?.hasAccount ? "No wallet yet" : w.liveEnabled ? "Live trading on" : "Live trading off"
          }
        />
      </section>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-labelledby="fleet-title" className="c-panel overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-6 py-5">
            <div className="flex items-center gap-3">
              <h2 id="fleet-title" className="text-lg font-semibold">
                Your fleet
              </h2>
              {!loading && <span className="c-chip">{bots.length}</span>}
            </div>
            <Link href="/bots" className="inline-flex items-center gap-1 text-sm text-[var(--c-dim)] hover:text-white">
              Manage all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {error ? (
            <div className="px-6 pb-6">
              <Notice tone="error">{(error as Error).message}</Notice>
            </div>
          ) : loading ? (
            <ul className="border-t border-white/10">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex items-center gap-4 border-b border-white/5 px-6 py-5">
                  <Skeleton className="h-10 w-10 !rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </li>
              ))}
            </ul>
          ) : bots.length === 0 ? (
            <div className="border-t border-white/10 px-6 py-14 text-center">
              <p className="c-serif text-3xl">No bots in orbit yet.</p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--c-dim)]">
                Create one, pick a signal, and it will trade in practice mode until you decide otherwise.
              </p>
              <button type="button" onClick={() => setCreating(true)} className="c-btn-primary mt-6">
                <Plus className="h-4 w-4" /> Launch your first bot
              </button>
            </div>
          ) : (
            <ul className="border-t border-white/10">
              {bots.slice(0, 8).map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-white/5 px-6 py-4 transition-colors last:border-b-0 hover:bg-white/[0.03]">
                  <BotAvatar id={b.id} active={b.status === "ACTIVE"} />
                  <div className="min-w-0 flex-1 basis-48">
                    <Link href={`/bots/${b.id}`} className="block truncate font-medium text-white hover:underline">
                      {b.name}
                    </Link>
                    <p className="c-mono mt-0.5 truncate text-xs text-[var(--c-faint)]">
                      {describeBot(b)} · {(b._count?.trades ?? 0).toLocaleString()} trades
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {b.strategy?.mode && (
                      <StatusBadge tone={b.strategy.mode === "live" ? "live" : "practice"}>
                        {b.strategy.mode === "live" ? "Live" : "Practice"}
                      </StatusBadge>
                    )}
                    <BotStatusBadge status={b.status} />
                  </div>
                  <div className="flex items-center gap-2">
                    <ActivationControl
                      botId={b.id}
                      status={b.status}
                      workflowId={b.keeperhubWorkflowId}
                      compact
                      onChanged={(next) => patchBot(b.id, next)}
                    />
                    <Link
                      href={`/bots/${b.id}/edit`}
                      aria-label={`Edit ${b.name}`}
                      title="Open visual editor"
                      className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-[var(--c-dim)] hover:bg-white/10 hover:text-white"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-6">
          <section aria-labelledby="checklist-title" className="c-panel p-6">
            <div className="flex items-center gap-4">
              <ProgressRing done={doneCount} total={checklist.length} />
              <div>
                <h2 id="checklist-title" className="text-lg font-semibold">
                  Launch checklist
                </h2>
                <p className="text-sm text-[var(--c-dim)]">
                  {doneCount === checklist.length ? "Fully cleared for live trading." : "Practice mode works at any step."}
                </p>
              </div>
            </div>
            <ol className="mt-5 space-y-1">
              {checklist.map((c) => (
                <li key={c.label}>
                  <Link href={c.href} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-white/5">
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                        c.done ? "border-transparent bg-gradient-to-br from-[#9277f5] to-[#e0619f]" : "border-white/20"
                      }`}
                    >
                      {c.done && <Check className="h-3.5 w-3.5 text-white" />}
                    </span>
                    <span className={`flex-1 text-sm ${c.done ? "text-[var(--c-faint)] line-through decoration-white/20" : "text-white"}`}>{c.label}</span>
                    {!c.done && <ArrowRight className="h-4 w-4 text-[var(--c-faint)] transition-transform group-hover:translate-x-0.5" />}
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="shortcuts-title" className="c-panel p-6">
            <h2 id="shortcuts-title" className="text-lg font-semibold">
              Shortcuts
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {SHORTCUTS.map((s) => (
                <Link key={s.href} href={s.href} className="flex min-h-24 flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-[rgba(247,168,207,0.35)] hover:bg-white/5">
                  <s.icon className="h-5 w-5 text-[var(--c-pink)]" />
                  <span className="text-sm leading-snug">{s.label}</span>
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <CreateBotDialog open={creating} onClose={() => setCreating(false)} />
    </PageShell>
  );
}
