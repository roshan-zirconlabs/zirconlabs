"use client";

import Link from "next/link";
import { ArrowRight, Repeat, ShieldCheck, TimerReset, Wallet } from "lucide-react";
import GalaxyJourney, { PLANETS } from "@/components/home/GalaxyJourney";

const GUARDRAILS = [
  {
    icon: Repeat,
    title: "One order per window",
    desc: "A bot can take at most one live order per market window — a leaked webhook or a retried alert can't multiply a trade.",
  },
  {
    icon: ShieldCheck,
    title: "A price ceiling on every order",
    desc: "Live orders carry a limit price derived from the market at signal time, so a stale quote can never fill you at a worse price.",
  },
  {
    icon: TimerReset,
    title: "Never auto-retried",
    desc: "If a live submission comes back uncertain, it's recorded as unknown and left alone — never silently resubmitted.",
  },
  {
    icon: Wallet,
    title: "Cash out anytime",
    desc: "Funds sit in your own Deposit Wallet, not ours. Sell a position or withdraw to your address whenever you want.",
  },
];

const STATS = [
  { value: "15m–1d", label: "Market windows tracked" },
  { value: "$1", label: "Minimum order size" },
  { value: "0", label: "Wallets you have to manage" },
  { value: "90s", label: "From rule to running bot" },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* ── HERO ── */}
      <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line-accent)] bg-white/80 px-3 py-1 text-[11px] font-medium text-[var(--muted)] backdrop-blur">
            Built on KeeperHub · Polymarket execution
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-[var(--ink)] sm:text-6xl">
            Write a rule.
            <br />
            Watch it trade five stops down the line.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
            Zircon Labs turns a chart pattern or a TradingView alert into a running Polymarket bot —
            no wallet setup, no gas, no manual order entry. Sign in, describe the trigger, and let it run.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/auth/sign-up" className="cosmic-btn-primary inline-flex items-center gap-1.5 px-6 py-3 text-sm">
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/auth/sign-in" className="cosmic-btn-ghost inline-flex items-center px-6 py-3 text-sm">
              Sign in
            </Link>
          </div>
          <p className="mt-4 text-xs text-[var(--muted2)]">Starts in paper mode. Flip to live only when you&rsquo;re ready.</p>
        </div>
        <div className="mx-auto mt-14 flex max-w-xs flex-col items-center gap-1 text-[var(--muted2)]">
          <span className="text-[10px] font-semibold tracking-[0.2em]">SCROLL</span>
          <span className="h-8 w-px animate-pulse bg-[var(--line-accent)]" />
        </div>
      </section>

      {/* ── JOURNEY ── */}
      <GalaxyJourney />

      {/* ── RECAP ── */}
      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center font-display text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl">
            Five steps. No web3 experience required.
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {PLANETS.map((p, i) => (
              <div key={p.name} className="glass-card rounded-[var(--r-xl)] p-5">
                <div
                  className="mb-4 h-10 w-10 rounded-full"
                  style={{
                    background: `radial-gradient(circle at 35% 30%, rgb(${p.glow}), rgb(${p.color}) 60%, rgba(${p.color},0.6) 100%)`,
                  }}
                />
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted2)]">Step {i + 1}</p>
                <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{p.name}</p>
                <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GUARDRAILS ── */}
      <section className="border-y border-[var(--line)] bg-[var(--bg-app-deep)] px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="font-display text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl">
              Automated doesn&apos;t mean unsupervised.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
              Every live order runs through the same guardrails, whether it&apos;s your first trade or your thousandth.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {GUARDRAILS.map((g) => (
              <div key={g.title} className="rounded-[var(--r-xl)] border border-[var(--line-accent)] bg-white p-5">
                <div className="mb-3 grid h-9 w-9 place-items-center rounded-full bg-[var(--accent-soft)]">
                  <g.icon className="h-4 w-4 text-[var(--primary)]" />
                </div>
                <p className="text-sm font-semibold text-[var(--ink)]">{g.title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">{g.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-[var(--r-xl)] border border-[var(--line-accent)] bg-white px-4 py-6 text-center">
              <p className="font-display text-2xl font-bold text-[var(--primary)] sm:text-3xl">{s.value}</p>
              <p className="mt-1.5 text-xs leading-snug text-[var(--muted)]">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CLOSING CTA ── */}
      <section className="relative overflow-hidden px-4 py-24 sm:px-6">
        <div className="relative mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-[var(--ink)] sm:text-4xl">
            Your first bot can be live in two minutes.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-[var(--muted)] sm:text-base">
            Start in paper mode, watch it trade against real markets, and switch to live whenever you trust it.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/auth/sign-up" className="cosmic-btn-primary inline-flex items-center gap-1.5 px-6 py-3 text-sm">
              Create your first bot <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/bots" className="cosmic-btn-ghost inline-flex items-center px-6 py-3 text-sm">
              See example bots
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
