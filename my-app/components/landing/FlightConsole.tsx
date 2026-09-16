"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { useCalmMotion } from "./motion";
import { Activity, Radio, ShieldCheck, Target, Trophy } from "lucide-react";

const PRICES = [
  0.66, 0.665, 0.655, 0.65, 0.645, 0.64, 0.628, 0.62, 0.61, 0.598, 0.59, 0.585, 0.582, 0.59, 0.6, 0.607,
  0.612, 0.62, 0.628, 0.635, 0.642, 0.65, 0.66, 0.668, 0.672, 0.68, 0.688, 0.695, 0.7, 0.708, 0.716,
  0.722, 0.73, 0.735, 0.742, 0.748, 0.752, 0.756, 0.76,
];
const ENTRY_INDEX = 16;
const W = 640;
const H = 240;
const MIN = 0.55;
const MAX = 0.78;

const x = (i: number) => (i / (PRICES.length - 1)) * W;
const y = (p: number) => H - ((p - MIN) / (MAX - MIN)) * H;
const LINE = PRICES.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
const AREA = `${LINE} L${W},${H} L0,${H} Z`;

const EVENTS = [
  { icon: Radio, time: "14:02:11", title: "Signal received", detail: "TradingView · RSI crossed under 30" },
  { icon: ShieldCheck, time: "14:02:11", title: "Guards passed", detail: "1 of 1 window slot · ceiling 0.63" },
  { icon: Target, time: "14:02:13", title: "Order filled", detail: "120 shares of YES at 0.61" },
  { icon: Activity, time: "14:09:40", title: "Holding", detail: "Mark 0.70 · exit rule armed" },
  { icon: Trophy, time: "14:17:00", title: "Window settled", detail: "Closed at 0.76 · +$18.00" },
];

export default function FlightConsole() {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const reduce = useCalmMotion();
  const [tick, setTick] = useState(0);
  const step = reduce ? EVENTS.length : tick;

  useEffect(() => {
    if (reduce || !inView) return;
    const id = setInterval(() => setTick((s) => (s >= EVENTS.length + 2 ? 0 : s + 1)), 1500);
    return () => clearInterval(id);
  }, [inView, reduce]);

  const shown = EVENTS.slice(0, Math.min(step, EVENTS.length));
  const progress = reduce ? 1 : Math.min(step / EVENTS.length, 1);

  return (
    <div ref={ref} className="c-glass c-beam overflow-hidden rounded-[28px] bg-[rgba(8,9,30,0.84)] text-left">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#e0619f] to-[#5b3fc4] text-sm font-semibold">O</span>
          <div>
            <p className="text-[15px] font-semibold">Orion-7</p>
            <p className="c-mono text-xs text-[var(--c-faint)]">BTC up or down · 15-minute window</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="c-mono rounded-full border border-white/15 px-2.5 py-1 text-[11px] uppercase tracking-wider text-[var(--c-dim)]">Paper</span>
          <span className="flex items-center gap-2 rounded-full bg-[rgba(224,97,159,0.14)] px-3 py-1 text-xs font-medium text-[var(--c-pink)]">
            <span className="c-pulse h-1.5 w-1.5 rounded-full bg-[var(--c-pink)]" />
            In flight
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.6fr_1fr]">
        <div className="relative border-b border-white/10 p-5 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-xs text-[var(--c-faint)]">YES price</p>
              <p className="c-mono mt-1 text-3xl font-medium tracking-tight">
                {(0.61 + 0.15 * progress).toFixed(2)}
              </p>
            </div>
            <p className="c-mono text-sm text-[#8ee6b8]">+{(24.6 * progress).toFixed(1)}%</p>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" role="img" aria-label="Simulated price chart: YES dips to 0.58, the bot buys at 0.61, and the window settles at 0.76">
            <defs>
              <linearGradient id="fc-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#e0619f" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#e0619f" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="fc-line" x1="0" x2="1">
                <stop offset="0%" stopColor="#9277f5" />
                <stop offset="100%" stopColor="#f7a8cf" />
              </linearGradient>
            </defs>
            {[0.6, 0.65, 0.7, 0.75].map((g) => (
              <g key={g}>
                <line x1="0" x2={W} y1={y(g)} y2={y(g)} stroke="white" strokeOpacity="0.06" />
                <text x={W} y={y(g) - 5} textAnchor="end" className="c-mono" fontSize="10" fill="white" fillOpacity="0.3">{g.toFixed(2)}</text>
              </g>
            ))}
            <line x1="0" x2={W} y1={y(0.63)} y2={y(0.63)} stroke="#f7a8cf" strokeOpacity="0.5" strokeDasharray="4 6" />
            <text x="4" y={y(0.63) - 6} className="c-mono" fontSize="10" fill="#f7a8cf" fillOpacity="0.8">price ceiling 0.63</text>
            <motion.path
              d={AREA}
              fill="url(#fc-area)"
              initial={false}
              animate={{ opacity: inView ? 1 : 0 }}
              transition={{ duration: 1.2 }}
            />
            <motion.path
              d={LINE}
              fill="none"
              stroke="url(#fc-line)"
              strokeWidth="2.5"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: inView ? 1 : 0 }}
              transition={{ duration: 2.4, ease: "easeInOut" }}
            />
            <g opacity={step >= 3 || reduce ? 1 : 0} style={{ transition: "opacity .5s" }}>
              <line x1={x(ENTRY_INDEX)} x2={x(ENTRY_INDEX)} y1={y(PRICES[ENTRY_INDEX])} y2={H} stroke="white" strokeOpacity="0.25" strokeDasharray="2 4" />
              <circle cx={x(ENTRY_INDEX)} cy={y(PRICES[ENTRY_INDEX])} r="10" fill="#e0619f" fillOpacity="0.25" />
              <circle cx={x(ENTRY_INDEX)} cy={y(PRICES[ENTRY_INDEX])} r="4.5" fill="#fff" />
              <text x={x(ENTRY_INDEX) + 12} y={y(PRICES[ENTRY_INDEX]) + 20} className="c-mono" fontSize="11" fill="white">BUY 0.61</text>
            </g>
            <g opacity={progress === 1 ? 1 : 0} style={{ transition: "opacity .5s" }}>
              <circle cx={W} cy={y(0.76)} r="12" fill="#f7a8cf" fillOpacity="0.2" />
              <circle cx={W} cy={y(0.76)} r="4.5" fill="#f7a8cf" />
            </g>
          </svg>
        </div>

        <div className="flex flex-col p-5 sm:p-6">
          <p className="c-mono mb-4 text-[11px] uppercase tracking-[0.18em] text-[var(--c-faint)]">Flight log</p>
          <ol className="relative flex min-h-[292px] flex-col gap-4" aria-live="polite">
            <AnimatePresence initial={false}>
              {shown.map((e) => (
                <motion.li
                  key={e.title}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="flex gap-3"
                >
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5">
                    <e.icon className="h-4 w-4 text-[var(--c-pink)]" />
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-baseline gap-2 text-sm font-medium">
                      {e.title}
                      <span className="c-mono text-[11px] font-normal text-[var(--c-faint)]">{e.time}</span>
                    </p>
                    <p className="truncate text-[13px] text-[var(--c-dim)]">{e.detail}</p>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
          <p className="mt-auto pt-4 text-[11px] text-[var(--c-faint)]">Simulated flight for illustration.</p>
        </div>
      </div>
    </div>
  );
}
