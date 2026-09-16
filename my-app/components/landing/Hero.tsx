"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useCalmMotion } from "./motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import FlightConsole from "./FlightConsole";

export default function Hero() {
  const reduce = useCalmMotion();
  const consoleRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: consoleRef, offset: ["start end", "center center"] });
  const tilt = useTransform(scrollYProgress, [0, 1], [28, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.92, 1]);

  const rise = (delay: number) => ({ style: { animationDelay: `${delay}s` } });

  return (
    <section className="relative isolate flex flex-col items-center px-5 pb-24 pt-36 text-center sm:pt-44">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-16 -z-10 h-[760px] w-[min(1100px,120vw)] -translate-x-1/2 bg-[radial-gradient(closest-side,rgba(5,7,26,0.72),rgba(5,7,26,0.35)_60%,transparent)]"
      />
      <a
        href="#mission"
        {...rise(0)}
        className="c-rise c-glass group mb-8 inline-flex items-center gap-2.5 rounded-full py-1.5 pl-2 pr-4 text-[13px] text-[var(--c-dim)] transition-colors hover:text-white"
      >
        <span className="rounded-full bg-[rgba(224,97,159,0.18)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--c-pink)]">
          Now live
        </span>
        Autonomous bots for Polymarket
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </a>

      <h1 className="c-serif max-w-5xl text-[clamp(3.25rem,10vw,8.75rem)] leading-[0.9] tracking-[-0.025em]">
        <span {...rise(0.1)} className="c-rise block">
          Put your strategy
        </span>
        <span {...rise(0.25)} className="c-rise c-nebula-text block italic">
          into orbit.
        </span>
      </h1>

      <p {...rise(0.45)} className="c-rise mt-8 max-w-xl text-[17px] leading-relaxed text-[var(--c-dim)] sm:text-lg">
        Zircon turns a chart signal into a bot that trades Polymarket for you — guarded on every order,
        traceable on every fill, and still running while you sleep.
      </p>

      <div {...rise(0.6)} className="c-rise mt-10 flex flex-col items-center gap-3 sm:flex-row">
        <Link href="/auth/sign-up" className="c-btn-primary w-full sm:w-auto">
          Launch your first bot
          <ArrowRight className="h-4 w-4" />
        </Link>
        <a href="#console" className="c-btn-ghost w-full sm:w-auto">
          Watch one fly
        </a>
      </div>

      <ul {...rise(0.75)} className="c-rise mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-[var(--c-faint)]">
        {["No wallet setup", "No gas fees", "Paper mode first"].map((t) => (
          <li key={t} className="flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-[var(--c-pink)]" />
            {t}
          </li>
        ))}
      </ul>

      <motion.a
        href="#console"
        aria-label="Scroll to the live demo"
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 2.4, repeat: Infinity }}
        className="mt-14 grid h-10 w-10 place-items-center rounded-full border border-white/15 text-[var(--c-faint)] hover:text-white"
      >
        <ChevronDown className="h-4 w-4" />
      </motion.a>

      <div id="console" ref={consoleRef} className="mt-16 w-full max-w-5xl scroll-mt-28 [perspective:1600px]">
        <motion.div style={reduce ? undefined : { rotateX: tilt, scale }} className="origin-bottom">
          <FlightConsole />
        </motion.div>
      </div>
    </section>
  );
}
