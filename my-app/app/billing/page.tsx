"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Check, Loader2 } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/components/ui/toast";
import { PageHeader, PageShell, StatusBadge } from "@/components/ui/page";
import { cn } from "@/lib/cn";

type PlanId = "FREE" | "PRO" | "ENTERPRISE";

const PLANS: { id: PlanId; name: string; price: string; period: string; blurb: string; features: string[] }[] = [
  {
    id: "FREE",
    name: "Launchpad",
    price: "$0",
    period: "forever",
    blurb: "Try one bot in practice mode.",
    features: ["1 bot", "Paper quote testing", "Visual workflows", "KeeperHub connection"],
  },
  {
    id: "PRO",
    name: "Orbit",
    price: "$29",
    period: "per month",
    blurb: "A small fleet for active traders.",
    features: ["3 bots", "Paper quote testing", "Visual workflows", "KeeperHub usage billed separately"],
  },
  {
    id: "ENTERPRISE",
    name: "Galaxy",
    price: "$99",
    period: "per month",
    blurb: "Room for every strategy you run.",
    features: ["100 bots", "Visual workflows", "Paper quote testing", "KeeperHub usage billed separately"],
  },
];

export default function BillingPage() {
  const { data: session } = useSession();
  const { plan: currentPlan } = useCurrentUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState<PlanId | "portal" | null>(null);

  async function checkout(plan: PlanId) {
    if (plan === "FREE") return;
    setLoading(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.assign(data.url);
        return;
      }
      toast({ title: data.error || "Stripe not configured", variant: "error" });
    } catch {
      toast({ title: "Checkout failed", variant: "error" });
    }
    setLoading(null);
  }

  async function openPortal() {
    setLoading("portal");
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.assign(data.url);
    else {
      toast({ title: data.error || "Portal unavailable", variant: "error" });
      setLoading(null);
    }
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Plans"
        title="Choose your"
        accent="altitude."
        description="Every plan trades in practice mode for free. Upgrade when you need more bots in the air."
        actions={
          session?.user && currentPlan !== "FREE" ? (
            <button type="button" onClick={openPortal} disabled={loading !== null} className="c-btn-ghost">
              {loading === "portal" && <Loader2 className="h-4 w-4 animate-spin" />}
              Manage subscription
            </button>
          ) : null
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {PLANS.map((p) => {
          const current = session?.user && currentPlan === p.id;
          const featured = p.id === "PRO";
          return (
            <section
              key={p.id}
              aria-labelledby={`plan-${p.id}`}
              className={cn(
                "c-panel relative flex flex-col overflow-hidden p-7",
                featured && "border-[rgba(247,168,207,0.45)] shadow-[0_0_80px_-30px_rgba(224,97,159,0.6)]",
              )}
            >
              {featured && (
                <div aria-hidden="true" className="pointer-events-none absolute -top-24 left-1/2 h-48 w-80 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(224,97,159,0.35),transparent)]" />
              )}
              <div className="relative flex items-center justify-between gap-2">
                <h2 id={`plan-${p.id}`} className="c-eyebrow">
                  {p.name}
                </h2>
                {current ? <StatusBadge tone="active">Current</StatusBadge> : featured ? <StatusBadge tone="practice">Popular</StatusBadge> : null}
              </div>
              <p className="relative mt-5 flex items-baseline gap-2">
                <span className="c-serif text-6xl leading-none text-white">{p.price}</span>
                <span className="text-sm text-[var(--c-faint)]">{p.period}</span>
              </p>
              <p className="relative mt-3 text-sm text-[var(--c-dim)]">{p.blurb}</p>
              <ul className="relative mt-6 flex-1 space-y-3 border-t border-white/10 pt-6">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-white">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--c-pink)]" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="relative mt-8">
                {!session?.user ? (
                  <Link href="/auth/sign-in?callbackUrl=/billing" className={cn("w-full", featured ? "c-btn-primary" : "c-btn-ghost")}>
                    Sign in to start
                  </Link>
                ) : current ? (
                  <button type="button" disabled className="c-btn-ghost w-full">
                    Your current plan
                  </button>
                ) : p.id === "FREE" ? (
                  <p className="text-center text-sm text-[var(--c-faint)]">Downgrade from Manage subscription</p>
                ) : (
                  <button type="button" onClick={() => void checkout(p.id)} disabled={loading !== null} className={cn("w-full", featured ? "c-btn-primary" : "c-btn-ghost")}>
                    {loading === p.id && <Loader2 className="h-4 w-4 animate-spin" />}
                    {loading === p.id ? "Redirecting…" : `Upgrade to ${p.name}`}
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </PageShell>
  );
}
