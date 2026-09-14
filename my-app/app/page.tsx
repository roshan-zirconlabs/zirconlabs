"use client";

import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  Cpu,
  Terminal,
  Sparkles,
  CheckCircle2,
  Workflow,
  BarChart2,
} from "lucide-react";

const stats = [
  { label: "Execution Engine", value: "KeeperHub v2", desc: "Deterministic SLA" },
  { label: "Polymarket Windows", value: "15m · 1h · 4h · 1d", desc: "Auto-rotating slugs" },
  { label: "Default Safety", value: "Paper Simulation", desc: "Risk-free evaluation" },
  { label: "Strategy Format", value: "Visual & Webhooks", desc: "Zero code required" },
];

const features = [
  {
    title: "Deterministic Execution",
    description: "Built on KeeperHub: nonces, private MEV routing, retries with exponential backoff, and full auditable records.",
    icon: ShieldCheck,
  },
  {
    title: "Active-Market Auto Resolution",
    description: "Never manually paste contract IDs. Zircon Labs floored timestamps automatically resolve the live Polymarket up/down window.",
    icon: Zap,
  },
  {
    title: "Visual Strategy Builder",
    description: "Compose multi-condition triggers, price filters, and automated order routing visually on our node canvas.",
    icon: Workflow,
  },
  {
    title: "Zero Private Key Custody",
    description: "Full wallet compatibility checks with Polygon Mainnet. Sign standard EIP-712 session allowances directly in your Web3 wallet.",
    icon: Cpu,
  },
];

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-[#fbfaff] text-slate-900 selection:bg-purple-500 selection:text-white">
      {/* ── HERO SECTION ── */}
      <section className="relative pt-20 pb-20 overflow-hidden border-b border-purple-100/80">
        {/* Ambient cosmic nebula blurs */}
        <div className="absolute top-0 right-1/4 -translate-y-1/2 w-[600px] h-[600px] bg-purple-400/15 blur-[140px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 translate-y-1/2 w-[500px] h-[500px] bg-pink-400/15 blur-[140px] rounded-full pointer-events-none" />

        <div className="container mx-auto px-6 relative z-10 max-w-6xl">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="lg:w-7/12">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50/80 px-3.5 py-1 text-xs font-mono font-medium text-purple-700 mb-6 shadow-xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-600"></span>
                </span>
                Powered by KeeperHub Engine · Live on Polygon
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6 text-slate-900">
                Automate Polymarket with{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600">
                  Deterministic Execution.
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 max-w-xl mb-8 leading-relaxed">
                Build, simulate, and run 24/7 automated bots on Polymarket up/down prediction markets — without manual wallet plumbing, contract hunting, or execution drift.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/dashboard"
                  className="cosmic-btn-primary inline-flex items-center gap-2 px-6 py-3 text-xs font-semibold"
                >
                  <Sparkles className="h-4 w-4" />
                  Launch Terminal
                </Link>
                <Link
                  href="/bots"
                  className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-white px-6 py-3 text-xs font-medium text-slate-700 hover:bg-purple-50 hover:text-purple-900 hover:border-purple-300 transition shadow-xs"
                >
                  View Bots
                  <ArrowRight className="h-4 w-4 text-purple-600" />
                </Link>
              </div>

              <div className="mt-8 flex items-center gap-6 text-xs text-slate-500 font-mono">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-purple-600" />
                  No Code Required
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-purple-600" />
                  TradingView Ready
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-purple-600" />
                  Paper Mode Active
                </div>
              </div>
            </div>

            {/* Live Visual Terminal Preview */}
            <div className="lg:w-5/12 w-full">
              <div className="rounded-2xl border border-purple-100 bg-white p-5 shadow-xl shadow-purple-900/5 font-mono text-xs space-y-4">
                <div className="flex items-center justify-between border-b border-purple-100 pb-3">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Terminal className="h-4 w-4 text-purple-600" />
                    <span className="font-semibold">keeperhub-worker.log</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                    SLA ACTIVE
                  </span>
                </div>

                <div className="space-y-2 text-slate-600 text-[11px] leading-relaxed">
                  <p className="text-slate-400">// Auto-rotating active window resolver</p>
                  <p>
                    <span className="text-purple-600 font-semibold">[00:00:00]</span> Target:{" "}
                    <span className="text-slate-900 font-semibold">btc-updown-15m-1726000000</span>
                  </p>
                  <p>
                    <span className="text-purple-600 font-semibold">[00:00:01]</span> Gamma API Token IDs:{" "}
                    <span className="text-emerald-600 font-semibold">YES=2149...</span> NO=2150...
                  </p>
                  <p>
                    <span className="text-purple-600 font-semibold">[00:00:02]</span> Strategy Signal:{" "}
                    <span className="text-purple-700 font-bold">UP (Confidence 0.92)</span>
                  </p>
                  <p>
                    <span className="text-purple-600 font-semibold">[00:00:03]</span> Order Routed:{" "}
                    <span className="text-slate-900 font-semibold">10.00 USDC @ 0.52 (FILLED)</span>
                  </p>
                  <p className="text-emerald-600 font-semibold">
                    ✔ Mirror Event posted to Zircon Labs /ingest/trade
                  </p>
                </div>

                <div className="pt-2 border-t border-purple-100 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Execution Time: 395ms</span>
                  <span>MEV Protection: Enabled</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS SECTION ── */}
      <section className="border-b border-purple-100/80 bg-purple-50/40">
        <div className="container mx-auto px-6 py-8 max-w-6xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((s, i) => (
              <div key={i} className="space-y-1">
                <div className="text-xs text-slate-400 uppercase tracking-wider font-mono">
                  {s.label}
                </div>
                <div className="text-lg sm:text-xl font-bold font-mono text-slate-900">
                  {s.value}
                </div>
                <div className="text-xs text-purple-600 font-medium">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES SECTION ── */}
      <section className="py-20 border-b border-purple-100/80 bg-[#fbfaff]">
        <div className="container mx-auto px-6 max-w-6xl space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Why Zircon Labs + KeeperHub?
            </h2>
            <p className="text-sm text-slate-600">
              Traditional trading bots suffer from probabilistic reinterpretation and brittle infrastructure. Zircon Labs guarantees deterministic value execution every single window.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  className="rounded-2xl border border-purple-100 bg-white p-6 space-y-3 hover:border-purple-200 hover:shadow-md transition"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 border border-purple-200 text-purple-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {f.title}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {f.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
