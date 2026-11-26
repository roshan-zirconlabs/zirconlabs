"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { PageHeader, PageShell, StatusBadge } from "@/components/ui/page";
import { cn } from "@/lib/cn";
import { PLANS, PERIOD_DAYS, type PlanId } from "@/lib/billing/plans";

type Billing = {
  plan: PlanId;
  activeBotLimit: number;
  runningBots: number;
  currentPeriodEnd: string | null;
  paymentAddress: string | null;
  acceptedTokens: { address: string; symbol: string }[];
  payments: { id: string; plan: PlanId; amount: string; status: "PENDING" | "PAID" | "EXPIRED"; expiresAt: string; paidAt: string | null; txHash: string | null; token: string | null }[];
};

const ORDER: PlanId[] = ["FREE", "PRO", "ENTERPRISE"];
const FEATURES = ["Practice and real-money bots", "TradingView alerts", "Live charts", "Public track record"];

export default function BillingPage() {
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const client = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const billing = useQuery({
    queryKey: ["billing"],
    enabled: status === "authenticated",
    // While an invoice is open, look for the payment every 20 seconds.
    refetchInterval: (q) => ((q.state.data as Billing | undefined)?.payments.some(p => p.status === "PENDING") ? 20_000 : false),
    queryFn: async (): Promise<Billing> => {
      const res = await fetch("/api/billing");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Plans could not be loaded.");
      return json;
    },
  });
  const data = billing.data;
  const open = data?.payments.find(p => p.status === "PENDING" && new Date(p.expiresAt) > new Date());

  async function post(body: Record<string, unknown>, key: string) {
    setBusy(key);
    try {
      const res = await fetch("/api/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong.");
      client.setQueryData(["billing"], json);
      if (body.action === "check" && !json.payments.some((p: Billing["payments"][number]) => p.status === "PENDING")) {
        toast({ variant: "success", title: "Payment received", description: "Your plan is active." });
      }
    } catch (error) {
      toast({ variant: "error", title: error instanceof Error ? error.message : "Something went wrong." });
    } finally {
      setBusy(null);
    }
  }

  function copy(text: string, key: string) {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Plans"
        title="Choose your"
        accent="altitude."
        description={`Plans differ only in how many bots run at once. Pay in USDC on Polygon; each payment covers ${PERIOD_DAYS} days and its transaction is your receipt.`}
      />

      {data && (
        <p className="mb-6 text-sm text-[var(--c-dim)]">
          You are on <span className="font-medium text-white">{PLANS[data.plan].name}</span> · {data.runningBots} of {data.activeBotLimit} bot{data.activeBotLimit === 1 ? "" : "s"} running
          {data.currentPeriodEnd && <> · paid until {new Date(data.currentPeriodEnd).toLocaleDateString()}</>}
        </p>
      )}

      {open && data?.paymentAddress && (
        <section className="c-panel mb-6 p-6" aria-labelledby="pay-now">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="pay-now" className="font-semibold">Pay for {PLANS[open.plan].name}</h2>
            <StatusBadge tone="practice">Waiting for payment</StatusBadge>
          </div>
          <ol className="mt-4 space-y-4 text-sm text-[var(--c-dim)]">
            <li>
              1. Send <span className="font-semibold text-white">exactly {open.amount}</span> USDC, USDC.e or pUSD on <span className="text-white">Polygon</span>. The extra cents identify your payment.
              <button type="button" onClick={() => copy(open.amount, "amount")} className="c-btn-ghost c-btn-sm ml-2 inline-flex">
                {copied === "amount" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy amount
              </button>
            </li>
            <li>
              2. To this address:
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <code className="c-mono min-w-0 flex-1 select-all break-all rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-[var(--c-pink)]">{data.paymentAddress}</code>
                <button type="button" onClick={() => copy(data.paymentAddress!, "address")} className="c-btn-ghost">
                  {copied === "address" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied === "address" ? "Copied" : "Copy"}
                </button>
              </div>
            </li>
            <li>3. Your plan switches on within about a minute of the transfer. This page checks automatically.</li>
          </ol>
          <p className="mt-4 text-xs text-[var(--c-faint)]">
            Send on Polygon only, and send the exact amount: a different amount cannot be matched to you. This invoice is open until {new Date(open.expiresAt).toLocaleString()}.
          </p>
          <button type="button" onClick={() => void post({ action: "check" }, "check")} disabled={busy !== null} className="c-btn-ghost mt-4">
            {busy === "check" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} I&rsquo;ve sent it — check now
          </button>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {ORDER.map((id) => {
          const p = PLANS[id];
          const current = data?.plan === id;
          const featured = id === "PRO";
          return (
            <section
              key={id}
              aria-labelledby={`plan-${id}`}
              className={cn(
                "c-panel relative flex flex-col overflow-hidden p-7",
                featured && "border-[rgba(247,168,207,0.45)] shadow-[0_0_80px_-30px_rgba(224,97,159,0.6)]",
              )}
            >
              <div className="relative flex items-center justify-between gap-2">
                <h2 id={`plan-${id}`} className="c-eyebrow">{p.name}</h2>
                {current ? <StatusBadge tone="active">Current</StatusBadge> : featured ? <StatusBadge tone="practice">Popular</StatusBadge> : null}
              </div>
              <p className="relative mt-5 flex items-baseline gap-2">
                <span className="c-serif text-6xl leading-none text-white">${p.priceUsd}</span>
                <span className="text-sm text-[var(--c-faint)]">{p.priceUsd === 0 ? "forever" : `per ${PERIOD_DAYS} days`}</span>
              </p>
              <p className="relative mt-3 text-sm text-[var(--c-dim)]">{p.blurb}</p>
              <ul className="relative mt-6 flex-1 space-y-3 border-t border-white/10 pt-6">
                {[`${p.activeBots} bot${p.activeBots === 1 ? "" : "s"} running at once`, ...FEATURES].map((f) => (
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
                ) : id === "FREE" ? (
                  <p className="text-center text-sm text-[var(--c-faint)]">{current ? "Your current plan" : "Paid plans return to Starter when they end"}</p>
                ) : data && !data.paymentAddress ? (
                  <p className="text-center text-sm text-[var(--c-faint)]">Payments open soon</p>
                ) : (
                  <button type="button" onClick={() => void post({ action: "invoice", plan: id }, id)} disabled={busy !== null || !data} className={cn("w-full", featured ? "c-btn-primary" : "c-btn-ghost")}>
                    {busy === id && <Loader2 className="h-4 w-4 animate-spin" />}
                    {current ? `Add ${PERIOD_DAYS} days` : `Pay for ${p.name}`}
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {data && data.payments.some(p => p.status === "PAID") && (
        <section className="c-panel mt-6 p-6">
          <h2 className="font-semibold">Payments</h2>
          <ul className="mt-3 divide-y divide-white/5 text-sm">
            {data.payments.filter(p => p.status === "PAID").map(p => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="text-white">{PLANS[p.plan].name} · {p.amount} {p.token}</span>
                <span className="text-[var(--c-faint)]">{p.paidAt && new Date(p.paidAt).toLocaleDateString()}</span>
                {p.txHash && (
                  <a href={`https://polygonscan.com/tx/${p.txHash}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--c-pink)] hover:underline">
                    Receipt <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageShell>
  );
}
