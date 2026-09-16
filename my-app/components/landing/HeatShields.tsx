"use client";

import type { PointerEvent, ReactNode } from "react";
import { motion } from "framer-motion";

function Card({ className = "", children, delay = 0 }: { className?: string; children: ReactNode; delay?: number }) {
  const track = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <motion.div
      onPointerMove={track}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`c-glass c-spotlight flex flex-col rounded-3xl bg-[rgba(8,9,30,0.78)] p-7 sm:p-8 ${className}`}
    >
      {children}
    </motion.div>
  );
}

function Copy({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return (
    <div className="relative z-10 mt-auto">
      <p className="c-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-pink)]">{kicker}</p>
      <h3 className="c-serif mt-3 text-3xl leading-tight sm:text-[34px]">{title}</h3>
      <p className="mt-3 max-w-md leading-relaxed text-[var(--c-dim)]">{body}</p>
    </div>
  );
}

const WINDOWS = ["14:00", "14:15", "14:30", "14:45", "15:00", "15:15"];

export default function HeatShields() {
  return (
    <section id="shields" className="relative scroll-mt-24 px-5 py-28 sm:py-36">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="c-mono text-xs uppercase tracking-[0.3em] text-[var(--c-pink)]">Heat shields</p>
            <h2 className="c-serif mt-5 text-5xl leading-[1] sm:text-7xl">
              Automated, <em className="c-nebula-text">never unsupervised.</em>
            </h2>
          </div>
          <p className="max-w-sm text-lg leading-relaxed text-[var(--c-dim)]">
            Every live order passes the same four checks — on your first trade and your ten-thousandth.
          </p>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-6">
          <Card className="min-h-[340px] md:col-span-4">
            <div className="relative mb-8 overflow-x-auto" aria-hidden="true">
              <div className="flex min-w-[460px] gap-2">
                {WINDOWS.map((w, i) => (
                  <div key={w} className="flex-1">
                    <div className="flex h-20 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
                      {i % 2 === 0 ? (
                        <span className="h-3 w-3 rounded-full bg-[var(--c-pink)] shadow-[0_0_14px_3px_rgba(247,168,207,0.7)]" />
                      ) : (
                        <span className="h-3 w-3 rounded-full border border-white/25" />
                      )}
                    </div>
                    <p className="c-mono mt-2 text-center text-[10px] text-[var(--c-faint)]">{w}</p>
                  </div>
                ))}
              </div>
            </div>
            <Copy
              kicker="01 · Window lock"
              title="One order per window."
              body="A leaked webhook or a retried alert can't multiply a trade. Each bot gets one live slot per market window — full stop."
            />
          </Card>

          <Card className="min-h-[340px] md:col-span-2" delay={0.1}>
            <div className="relative mb-8 flex justify-center" aria-hidden="true">
              <svg viewBox="0 0 160 90" className="w-44">
                <defs>
                  <linearGradient id="hs-g" x1="0" x2="1">
                    <stop offset="0" stopColor="#9277f5" />
                    <stop offset="1" stopColor="#f7a8cf" />
                  </linearGradient>
                </defs>
                <path d="M15 80a65 65 0 0 1 130 0" fill="none" stroke="white" strokeOpacity="0.1" strokeWidth="10" strokeLinecap="round" />
                <path d="M15 80a65 65 0 0 1 104-52" fill="none" stroke="url(#hs-g)" strokeWidth="10" strokeLinecap="round" />
                <line x1="119" y1="28" x2="128" y2="17" stroke="white" strokeWidth="2" />
                <text x="80" y="76" textAnchor="middle" fill="white" fontSize="18" className="c-mono">0.63</text>
              </svg>
            </div>
            <Copy
              kicker="02 · Ceiling"
              title="A hard price limit."
              body="Every order carries a limit set from the market at signal time. A stale quote can never fill you worse."
            />
          </Card>

          <Card className="min-h-[300px] md:col-span-3" delay={0.05}>
            <div className="mb-8 flex flex-wrap items-center gap-2 c-mono text-xs" aria-hidden="true">
              <span className="rounded-full border border-white/15 px-3 py-1.5 text-[var(--c-dim)]">submit</span>
              <span className="text-[var(--c-faint)]">→</span>
              <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-amber-200">uncertain</span>
              <span className="text-[var(--c-faint)]">→</span>
              <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-white">held for review</span>
            </div>
            <Copy
              kicker="03 · No blind retries"
              title="Uncertain means hands off."
              body="If a live submission comes back unclear, it's logged as unknown and left alone — never silently fired again."
            />
          </Card>

          <Card className="min-h-[300px] md:col-span-3" delay={0.15}>
            <div className="mb-8 flex items-center gap-3" aria-hidden="true">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[radial-gradient(circle_at_30%_30%,#fff1d6,#e8ac4e_50%,#6a3420)] text-sm font-semibold text-[#2b1408]">$</span>
              <span className="h-px flex-1 bg-gradient-to-r from-white/30 to-transparent" />
              <span className="c-mono rounded-full border border-white/15 px-3 py-1.5 text-xs text-[var(--c-dim)]">0x…your address</span>
            </div>
            <Copy
              kicker="04 · Your exit"
              title="Cash out any time."
              body="Funds live in your own Deposit Wallet. Sell a position back to the book or withdraw whenever you want."
            />
          </Card>
        </div>
      </div>
    </section>
  );
}
