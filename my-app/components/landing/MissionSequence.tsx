"use client";

import { useRef } from "react";
import { motion, useInView, useScroll, useSpring } from "framer-motion";
import { FlaskConical, Rocket, Search, ShieldCheck } from "lucide-react";

const STEPS = [
  {
    code: "T–3",
    icon: Search,
    title: "Pick a market",
    body: "Search any open Polymarket market — elections, sports, crypto, the Fed. See live prices, the fee, and exactly what a share pays.",
    tag: "Every Polymarket market",
  },
  {
    code: "T–2",
    icon: ShieldCheck,
    title: "Set your safety net",
    body: "Buy with a take-profit and stop-loss attached, add a trailing stop, or tell Zircon to buy only when the price reaches your level.",
    tag: "Take-profit · Stop-loss · Trailing · Entries",
  },
  {
    code: "T–1",
    icon: FlaskConical,
    title: "Practice first",
    body: "Start with $1,000 of practice money on real order books with real fees. Every fill, exit and payout behaves like the real thing.",
    tag: "Practice mode",
  },
  {
    code: "T–0",
    icon: Rocket,
    title: "Ignition",
    body: "Deposit from any major chain and flip one switch to go live. Every order has a price limit, a daily cap, and a kill switch behind it.",
    tag: "Live on Polymarket",
  },
];

function Step({ step, index }: { step: (typeof STEPS)[number]; index: number }) {
  const ref = useRef<HTMLLIElement | null>(null);
  const lit = useInView(ref, { amount: 0.6, margin: "0px 0px -20% 0px" });
  const right = index % 2 === 1;

  return (
    <li ref={ref} className="relative grid grid-cols-[40px_1fr] gap-6 md:grid-cols-[1fr_64px_1fr] md:gap-0">
      <div className="relative flex justify-center md:col-start-2 md:row-start-1">
        <span
          className={`relative z-10 mt-6 grid h-10 w-10 place-items-center rounded-full border transition-all duration-700 ${
            lit ? "border-white/70 bg-[radial-gradient(circle,#f7a8cf,#9277f5)] shadow-[0_0_34px_8px_rgba(224,97,159,0.6)]" : "border-white/15 bg-[#0a0c24]"
          }`}
        >
          <span className={`h-2 w-2 rounded-full transition-colors duration-700 ${lit ? "bg-white" : "bg-white/30"}`} />
        </span>
      </div>

      <motion.article
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className={`c-glass rounded-3xl bg-[rgba(8,9,30,0.74)] p-6 sm:p-8 md:row-start-1 ${
          right ? "md:col-start-3 md:ml-6" : "md:col-start-1 md:mr-6"
        }`}
      >
        <div className="mb-5 flex items-center justify-between">
          <span className="c-mono text-sm tracking-widest text-[var(--c-pink)]">{step.code}</span>
          <step.icon className="h-5 w-5 text-[var(--c-dim)]" aria-hidden="true" />
        </div>
        <h3 className="c-serif text-3xl sm:text-4xl">{step.title}</h3>
        <p className="mt-3 leading-relaxed text-[var(--c-dim)]">{step.body}</p>
        <p className="c-mono mt-6 inline-block rounded-full border border-white/10 px-3 py-1 text-xs text-[var(--c-faint)]">{step.tag}</p>
      </motion.article>
    </li>
  );
}

export default function MissionSequence() {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 70%", "end 60%"] });
  const fill = useSpring(scrollYProgress, { stiffness: 90, damping: 24 });

  return (
    <section id="mission" className="relative scroll-mt-24 px-5 py-28 sm:py-36">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="c-mono text-xs uppercase tracking-[0.3em] text-[var(--c-pink)]">Mission sequence</p>
          <h2 className="c-serif mt-5 text-5xl leading-[1] sm:text-7xl">
            From idea to protected trade in <em className="c-nebula-text">four steps.</em>
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-[var(--c-dim)]">
            No web3 experience needed. If you can describe a trade, you can launch it.
          </p>
        </div>

        <div ref={ref} className="relative mt-20">
          <div className="absolute bottom-0 left-[19px] top-0 w-px bg-white/10 md:left-1/2 md:-translate-x-1/2" aria-hidden="true">
            <motion.div
              style={{ scaleY: fill }}
              className="h-full w-full origin-top bg-gradient-to-b from-[#9277f5] via-[#e0619f] to-[#f7a8cf] shadow-[0_0_12px_2px_rgba(224,97,159,0.6)]"
            />
          </div>
          <ol className="relative flex flex-col gap-10 md:gap-4">
            {STEPS.map((s, i) => (
              <Step key={s.code} step={s} index={i} />
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
