"use client";

import { ArrowRight, Clock, GitBranch, Search, Send, Wallet, Webhook } from "lucide-react";
import { RULES } from "@/lib/workflow/strategy";

type Spec = {
  source: "schedule" | "webhook";
  rule: string;
  timeframe: string;
  mode: "paper" | "live";
};

type Step = { icon: typeof Clock; label: string; desc: string; tone: "neutral" | "live" | "paper" };

/**
 * Mirrors lib/workflow/compile.ts's node shape so this always matches what
 * actually gets published to KeeperHub — a schedule/webhook trigger, an
 * optional on-chain balance check, the rule (dropped for webhook-sourced
 * bots, since the alert already decided), and the order step.
 */
function pipelineSteps(spec: Spec): Step[] {
  const steps: Step[] = [];
  steps.push(
    spec.source === "webhook"
      ? { icon: Webhook, label: "Alert arrives", desc: "From TradingView", tone: "neutral" }
      : { icon: Clock, label: "Schedule fires", desc: spec.timeframe, tone: "neutral" },
  );
  if (spec.mode === "live") {
    steps.push({ icon: Wallet, label: "Check balance", desc: "On-chain, via KeeperHub", tone: "live" });
  }
  if (spec.source !== "webhook") {
    const rule = RULES.find(r => r.id === spec.rule);
    steps.push({ icon: Search, label: "Read signal", desc: rule?.label ?? spec.rule, tone: "neutral" });
    steps.push({ icon: GitBranch, label: "Tradable?", desc: "Only continues if yes", tone: "neutral" });
  }
  steps.push({
    icon: Send,
    label: "Place order",
    desc: spec.mode === "live" ? "Real order · Polymarket" : "Paper fill · simulated",
    tone: spec.mode === "live" ? "live" : "paper",
  });
  return steps;
}

const toneClass: Record<Step["tone"], string> = {
  neutral: "border-white/10 bg-white/[0.03] text-white",
  live: "border-amber-300/40 bg-amber-50 text-amber-800",
  paper: "border-emerald-300/40 bg-emerald-50 text-emerald-800",
};
const iconToneClass: Record<Step["tone"], string> = {
  neutral: "bg-white/10 text-[var(--c-pink)]",
  live: "bg-amber-100 text-amber-700",
  paper: "bg-emerald-100 text-emerald-700",
};

/** A live, always-accurate diagram of what this strategy compiles into. */
export default function PipelinePreview({ spec }: { spec: Spec }) {
  const steps = pipelineSteps(spec);
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max items-center gap-1.5 py-1">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={i} className="flex items-center gap-1.5">
              <div className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 ${toneClass[step.tone]}`}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconToneClass[step.tone]}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span>
                  <span className="block text-xs font-semibold leading-tight">{step.label}</span>
                  <span className="block text-[11px] leading-tight opacity-80">{step.desc}</span>
                </span>
              </div>
              {i < steps.length - 1 && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--c-faint)]" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
