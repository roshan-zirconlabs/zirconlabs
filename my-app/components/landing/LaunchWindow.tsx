"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "framer-motion";
import { useCalmMotion } from "./motion";
import { ArrowRight } from "lucide-react";
import { OrbitMark } from "@/components/brand/OrbitMark";

function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.8 });
  const reduce = useCalmMotion();
  const [count, setV] = useState(0);
  const v = reduce ? to : count;
  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(0, to, { duration: 1.8, ease: [0.22, 1, 0.36, 1], onUpdate: (n) => setV(Math.round(n)) });
    return () => c.stop();
  }, [inView, reduce, to]);
  return (
    <span ref={ref}>
      {v}
      {suffix}
    </span>
  );
}

const STATS = [
  { value: <>15m–1d</>, label: "Market windows your bots can trade" },
  { value: <>$1</>, label: "Minimum order — start as small as you like" },
  { value: <>0</>, label: "Seed phrases, gas tokens or wallets to juggle" },
  { value: <CountUp to={90} suffix="s" />, label: "From a written rule to a running bot" },
];

const FOOTER = [
  { title: "Product", links: [["Bots", "/bots"], ["Markets", "/markets"], ["Backtest", "/backtest"], ["Wallet", "/wallet"]] },
  { title: "Account", links: [["Sign in", "/auth/sign-in"], ["Create account", "/auth/sign-up"], ["Plans", "/billing"], ["Connections", "/connections"]] },
];

export default function LaunchWindow() {
  return (
    <>
      <section aria-label="Zircon Labs at a glance" className="px-5 py-20">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col-reverse gap-3 bg-[rgba(7,8,28,0.82)] p-7 sm:p-9">
              <dt className="text-sm leading-snug text-[var(--c-dim)]">{s.label}</dt>
              <dd className="c-serif c-nebula-text text-5xl sm:text-6xl">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="relative overflow-hidden pt-32 sm:pt-44">
        <div className="relative z-10 mx-auto max-w-3xl px-5 text-center">
          <p className="c-mono text-xs uppercase tracking-[0.3em] text-[var(--c-pink)]">T–minus you</p>
          <h2 className="c-serif mt-6 text-[clamp(3rem,8vw,7rem)] leading-[0.95]">
            The launch window <em className="c-nebula-text">is open.</em>
          </h2>
          <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-[var(--c-dim)]">
            Start in paper mode, watch your bot fly against real markets, and go live only when you trust it.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/auth/sign-up" className="c-btn-primary w-full sm:w-auto">
              Launch your first bot
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/bots" className="c-btn-ghost w-full sm:w-auto">
              Explore example bots
            </Link>
          </div>
        </div>

        <div className="relative mt-24 h-[340px] sm:h-[420px]" aria-hidden="true">
          <div className="absolute left-1/2 top-24 h-[170vw] w-[170vw] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_50%_0%,rgba(247,168,207,0.35),transparent_40%)] blur-2xl" />
          <div className="absolute left-1/2 top-28 h-[170vw] w-[170vw] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_50%_0%,#2a1d5c_0%,#0c0b26_18%,#05071a_40%)] shadow-[0_-2px_0_0_rgba(255,220,240,0.85),0_-10px_40px_4px_rgba(224,97,159,0.65),0_-40px_120px_20px_rgba(146,119,245,0.45)]" />
        </div>

        <footer className="relative z-10 -mt-44 bg-gradient-to-b from-transparent to-[#05071a] px-5 pb-10 sm:-mt-56">
          <div className="mx-auto grid max-w-6xl gap-10 border-t border-white/10 pt-12 sm:grid-cols-[2fr_1fr_1fr]">
            <div>
              <Link href="/" className="inline-flex items-center gap-2.5" aria-label="Zircon Labs home">
                <OrbitMark className="h-8 w-8" />
                <span className="text-lg font-semibold tracking-tight">Zircon Labs</span>
              </Link>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-[var(--c-faint)]">
                Autonomous trading bots for Polymarket, built on KeeperHub.
              </p>
            </div>
            {FOOTER.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <p className="c-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-faint)]">{col.title}</p>
                <ul className="mt-4 space-y-1">
                  {col.links.map(([label, href]) => (
                    <li key={href}>
                      <Link href={href} className="inline-block py-1.5 text-sm text-[var(--c-dim)] transition-colors hover:text-white">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
          <div className="mx-auto mt-12 flex max-w-6xl flex-col justify-between gap-2 text-xs text-[var(--c-faint)] sm:flex-row">
            <p>© {new Date().getFullYear()} Zircon Labs</p>
            <p>Trading involves risk. Paper results don&rsquo;t guarantee live performance.</p>
          </div>
        </footer>
      </section>
    </>
  );
}
