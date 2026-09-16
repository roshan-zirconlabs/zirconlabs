"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useCalmMotion } from "./motion";
import { ChartLine, FlaskConical, Radio, Satellite, Wallet, Workflow } from "lucide-react";

const TILT = (-14 * Math.PI) / 180;
const ORBITS = [
  { rx: 0.25, ry: 0.13 },
  { rx: 0.36, ry: 0.19 },
  { rx: 0.47, ry: 0.25 },
];

const FEATURES = [
  {
    name: "Signals",
    icon: Radio,
    orbit: 0, phase: 0.3, speed: 0.32, size: 34,
    surface: "radial-gradient(circle at 32% 28%, #ffe2d6, #ef8a66 45%, #6d2a2a 100%)",
    title: "Signals that never sleep",
    body: "TradingView webhooks, indicator rules and price thresholds feed your bot the moment they fire — no tab left open, no alarm clock.",
  },
  {
    name: "Node editor",
    icon: Workflow,
    orbit: 0, phase: 3.4, speed: 0.32, size: 28,
    surface: "radial-gradient(circle at 32% 28%, #e3f7ff, #6fb6f0 45%, #1d3a7a 100%)",
    title: "Logic you can see",
    body: "Triggers, conditions, sizing and exits are connected nodes on a canvas. Change a rule by moving a wire, not rewriting a script.",
  },
  {
    name: "Backtests",
    icon: FlaskConical,
    orbit: 1, phase: 1.2, speed: 0.22, size: 44, ring: true,
    surface: "radial-gradient(circle at 32% 28%, #f1e6ff, #9d7cf2 45%, #2d1d6b 100%)",
    title: "Rehearse on real history",
    body: "Replay a strategy across past Polymarket windows and see its win rate and drawdown before a single dollar is at risk.",
  },
  {
    name: "Paper orbit",
    icon: Satellite,
    orbit: 1, phase: 4.3, speed: 0.22, size: 30,
    surface: "radial-gradient(circle at 32% 28%, #dffff4, #4fc7a4 45%, #0f4a45 100%)",
    title: "Practice against live books",
    body: "Paper mode fills against the real order book with simulated money, so your paper results behave like the real thing.",
  },
  {
    name: "Deposit Wallet",
    icon: Wallet,
    orbit: 2, phase: 2.2, speed: 0.15, size: 50,
    surface: "radial-gradient(circle at 32% 28%, #fff1d6, #e8ac4e 40%, #b0602e 70%, #4a2418 100%)",
    title: "Your funds, your wallet",
    body: "Capital sits in a Deposit Wallet you control — not ours. Sell a position or withdraw to your own address whenever you like.",
  },
  {
    name: "Analytics",
    icon: ChartLine,
    orbit: 2, phase: 5.3, speed: 0.15, size: 38,
    surface: "radial-gradient(circle at 32% 28%, #ffe0ef, #e0619f 45%, #521a44 100%)",
    title: "Every fill, accounted for",
    body: "P&L curves, win rates and a full trade history for each bot, split cleanly between paper and live.",
  },
];

export default function OrbitalSystem() {
  const reduce = useCalmMotion();
  const boxRef = useRef<HTMLDivElement | null>(null);
  const planetRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const elapsed = useRef(0);
  const [active, setActive] = useState(0);
  const [pinned, setPinned] = useState(false);
  const [size, setSize] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const ro = new ResizeObserver(([e]) => setSize(e.contentRect.width));
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "120px" });
    ro.observe(box);
    io.observe(box);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!size) return;
    let raf = 0;
    const start = performance.now() - elapsed.current * 1000;
    const place = (now: number) => {
      const t = reduce ? 0 : (now - start) / 1000;
      elapsed.current = t;
      FEATURES.forEach((f, i) => {
        const el = planetRefs.current[i];
        if (!el) return;
        const o = ORBITS[f.orbit];
        const a = f.phase + t * f.speed;
        const ex = Math.cos(a) * o.rx * size;
        const ey = Math.sin(a) * o.ry * size;
        const px = ex * Math.cos(TILT) - ey * Math.sin(TILT);
        const py = ex * Math.sin(TILT) + ey * Math.cos(TILT);
        const front = Math.sin(a) > 0;
        const depth = 0.78 + 0.22 * ((Math.sin(a) + 1) / 2);
        el.style.transform = `translate(-50%, -50%) translate(${px}px, ${py}px) scale(${depth})`;
        el.style.zIndex = front ? "20" : "1";
        el.style.opacity = String(0.55 + 0.45 * depth);
      });
      if (!reduce && visible) raf = requestAnimationFrame(place);
    };
    raf = requestAnimationFrame(place);
    return () => cancelAnimationFrame(raf);
  }, [size, reduce, visible]);

  useEffect(() => {
    if (pinned || reduce || !visible) return;
    const id = setInterval(() => setActive((a) => (a + 1) % FEATURES.length), 4200);
    return () => clearInterval(id);
  }, [pinned, reduce, visible]);

  const choose = (i: number) => {
    setActive(i);
    setPinned(true);
  };
  const f = FEATURES[active];

  return (
    <section id="system" className="relative scroll-mt-24 overflow-hidden px-5 py-28 sm:py-36">
      <div className="mx-auto max-w-2xl text-center">
        <p className="c-mono text-xs uppercase tracking-[0.3em] text-[var(--c-pink)]">The system</p>
        <h2 className="c-serif mt-5 text-5xl leading-[1] sm:text-7xl">
          Everything orbits <em className="c-nebula-text">your strategy.</em>
        </h2>
      </div>

      <div className="mx-auto mt-16 grid max-w-6xl items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
        <div ref={boxRef} className="relative mx-auto aspect-square w-full max-w-[580px]">
          <svg viewBox="-50 -50 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
            {ORBITS.map((o, i) => (
              <ellipse
                key={i}
                cx="0"
                cy="0"
                rx={o.rx * 100}
                ry={o.ry * 100}
                transform="rotate(-14)"
                fill="none"
                stroke="white"
                strokeOpacity={FEATURES[active].orbit === i ? 0.55 : 0.2}
                strokeWidth="0.3"
                strokeDasharray={i === 1 ? "0.6 1.2" : undefined}
                style={{ transition: "stroke-opacity .5s" }}
              />
            ))}
          </svg>

          <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
            <div className="h-24 w-24 rounded-full bg-[radial-gradient(circle,#fff_0%,#ffe6f3_22%,#f08bbd_48%,rgba(146,119,245,0.5)_70%,transparent_72%)] shadow-[0_0_80px_30px_rgba(224,97,159,0.45),0_0_200px_80px_rgba(146,119,245,0.3)] sm:h-32 sm:w-32" />
            <p className="c-mono absolute left-1/2 top-full mt-3 -translate-x-1/2 whitespace-nowrap text-[11px] uppercase tracking-[0.2em] text-[var(--c-dim)]">
              Your strategy
            </p>
          </div>

          {FEATURES.map((p, i) => (
            <button
              key={p.name}
              ref={(el) => {
                planetRefs.current[i] = el;
              }}
              type="button"
              onMouseEnter={() => choose(i)}
              onFocus={() => choose(i)}
              onClick={() => choose(i)}
              aria-label={p.name}
              aria-pressed={active === i}
              className="group absolute left-1/2 top-1/2 grid place-items-center rounded-full p-2 will-change-transform"
            >
              <span
                className={`relative block rounded-full transition-shadow duration-500 ${p.ring ? "c-planet-ring" : ""} ${
                  active === i ? "shadow-[0_0_0_2px_rgba(255,255,255,0.85),0_0_30px_6px_rgba(247,168,207,0.6)]" : "shadow-[inset_-6px_-6px_12px_rgba(0,0,0,0.45)]"
                }`}
                style={{ width: p.size, height: p.size, background: p.surface }}
              />
              <span
                className={`c-mono pointer-events-none absolute top-full mt-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider transition-opacity ${
                  active === i ? "bg-white/10 text-white opacity-100" : "text-[var(--c-faint)] opacity-0 group-hover:opacity-100 sm:opacity-70"
                }`}
              >
                {p.name}
              </span>
            </button>
          ))}
        </div>

        <div>
          <div className="c-glass relative min-h-[250px] overflow-hidden rounded-3xl bg-[rgba(8,9,30,0.74)] p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35 }}
                aria-live="polite"
              >
                <div className="mb-6 flex items-center gap-3">
                  <span className="h-10 w-10 rounded-full" style={{ background: f.surface }} />
                  <span className="c-mono text-xs uppercase tracking-[0.2em] text-[var(--c-dim)]">{f.name}</span>
                </div>
                <h3 className="c-serif text-4xl leading-tight">{f.title}</h3>
                <p className="mt-4 text-[17px] leading-relaxed text-[var(--c-dim)]">{f.body}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FEATURES.map((p, i) => (
              <button
                key={p.name}
                type="button"
                onClick={() => choose(i)}
                aria-pressed={active === i}
                className={`flex min-h-11 items-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-sm transition-colors ${
                  active === i ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-[var(--c-dim)] hover:border-white/20 hover:text-white"
                }`}
              >
                <p.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
