"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search, ShieldCheck, Wallet } from "lucide-react";
import { PageHeader, PageShell, StatTile, EmptyState, Notice, StatusBadge } from "@/components/ui/page";
import Skeleton from "@/components/ui/skeleton";
import ActivityFeed from "@/components/app/activity-feed";
import EngineStatus from "@/components/app/engine-status";
import { api, cents, money, until, useMe } from "@/lib/client";

type Holding = {
  tokenId: string; marketSlug: string; question: string; outcome: string; shares: number; avgPrice: number;
  price: number | null; valueUsd: number; costUsd: number; pnlUsd: number; endDate: string | null; claimable: boolean;
};
type Portfolio = { mode: "PAPER" | "LIVE"; cashUsd: number; holdings: Holding[]; positionsValueUsd: number; unavailable?: string };
type Automation = { id: string; kind: string; status: string; tokenId?: string; marketSlug: string; outcome: string; summary: string };

export default function PortfolioPage() {
  const { data: me } = useMe();
  const mode = me?.mode ?? "PAPER";
  const portfolio = useQuery({ queryKey: ["portfolio", mode], queryFn: () => api<Portfolio>(`/api/portfolio?mode=${mode}`), enabled: !!me, refetchInterval: 20_000 });
  const automations = useQuery({ queryKey: ["automations", mode], queryFn: () => api<{ automations: Automation[] }>(`/api/automations?mode=${mode}`), enabled: !!me });

  const active = automations.data?.automations.filter((a) => a.status === "ACTIVE") ?? [];
  const protectedKeys = new Set(active.filter((a) => a.kind === "EXIT").map((a) => `${a.marketSlug}:${a.outcome}`));
  const p = portfolio.data;
  const total = p ? p.cashUsd + p.positionsValueUsd : 0;
  const pnl = p ? p.holdings.reduce((s, h) => s + h.pnlUsd, 0) : 0;
  const liveNotReady = mode === "LIVE" && me && !(me.live.account && me.live.enabled);

  return (
    <PageShell>
      <PageHeader
        eyebrow={mode === "LIVE" ? "Live portfolio" : "Practice portfolio"}
        title="Portfolio"
        description={mode === "PAPER" ? "Practice with real prices and real fees — no money moves. Switch to Live when you're ready." : "Your real Polymarket positions, read straight from Polymarket."}
        actions={<Link href="/markets" className="c-btn-primary"><Search className="h-4 w-4" /> Find a market</Link>}
      />

      {liveNotReady && (
        <div className="mb-6">
          <Notice tone="warning">
            Live trading isn&rsquo;t set up yet. <Link href="/account" className="underline">Create and fund your live wallet</Link> — or switch back to Practice.
          </Notice>
        </div>
      )}
      {me?.live.paused && mode === "LIVE" && <div className="mb-6"><Notice tone="error">Kill switch is on: no live orders will be placed. Turn it off in <Link href="/account" className="underline">Account</Link>.</Notice></div>}
      {p?.unavailable && <div className="mb-6"><Notice tone="error">{p.unavailable}</Notice></div>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {portfolio.isLoading || !p ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28" />) : (
          <>
            <StatTile label={mode === "PAPER" ? "Practice cash" : "Cash"} value={money(p.cashUsd)} icon={Wallet} />
            <StatTile label="In positions" value={money(p.positionsValueUsd)} hint={`${p.holdings.length} open`} />
            <StatTile label="Total value" value={money(total)} tone="accent" />
            <StatTile label="Open P&L" value={money(pnl, true)} tone={pnl > 0 ? "good" : pnl < 0 ? "bad" : "default"} />
          </>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-white">Positions</h2>
            <EngineStatus hasActive={active.length > 0} />
          </div>
          {portfolio.isLoading ? <Skeleton className="h-48 w-full" /> : !p || p.holdings.length === 0 ? (
            <EmptyState
              title={mode === "PAPER" ? "Make your first practice trade" : "No live positions yet"}
              body={mode === "PAPER" ? "You have practice cash to spend. Pick any market, buy a side, and set a take-profit and stop-loss — Zircon handles the rest." : "Deposit to your live wallet in Account, then buy from any market."}
              action={<Link href="/markets" className="c-btn-primary">Browse markets <ArrowRight className="h-4 w-4" /></Link>}
            />
          ) : (
            <ul className="space-y-3">
              {p.holdings.map((h) => (
                <li key={h.tokenId}>
                  <Link href={`/markets/${h.marketSlug}`} className="c-panel c-panel-hover block p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-white">{h.question}</p>
                        <p className="mt-1 text-xs text-[var(--c-faint)]">
                          {h.shares.toFixed(2)} {h.outcome} · avg {cents(h.avgPrice)} → {cents(h.price)} · {until(h.endDate)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-white tabular-nums">{money(h.valueUsd)}</p>
                        <p className={`text-xs tabular-nums ${h.pnlUsd >= 0 ? "text-[var(--c-up)]" : "text-[var(--c-down)]"}`}>{money(h.pnlUsd, true)}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {protectedKeys.has(`${h.marketSlug}:${h.outcome}`)
                        ? <StatusBadge tone="active">Protected</StatusBadge>
                        : <span className="c-chip border-white/15 text-[var(--c-dim)]"><ShieldCheck className="h-3 w-3" /> Unprotected — open to add a stop-loss</span>}
                      {h.claimable && <StatusBadge tone="active">Won — claiming automatically</StatusBadge>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {active.length > 0 && (
            <div className="mt-8">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-white">Running automations</h2>
                <Link href="/automations" className="text-sm text-[var(--c-dim)] hover:text-white">Manage →</Link>
              </div>
              <ul className="space-y-2">
                {active.slice(0, 5).map((a) => (
                  <li key={a.id} className="c-panel px-4 py-3 text-sm text-white">{a.summary}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="c-panel h-fit min-w-0 p-5">
          <h2 className="mb-4 font-semibold text-white">Activity</h2>
          <ActivityFeed mode={mode} />
        </section>
      </div>
    </PageShell>
  );
}
