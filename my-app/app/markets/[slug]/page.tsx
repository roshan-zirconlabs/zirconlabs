"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Copy, ShieldCheck } from "lucide-react";
import { PageShell, Notice, StatusBadge } from "@/components/ui/page";
import Skeleton from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import ProtectFields, { emptyProtect, hasProtect, protectProblem, toProtect, type ProtectDraft } from "@/components/app/protect-fields";
import { api, cents, money, newRequestId, until, useMe, type Mode } from "@/lib/client";
import { cn } from "@/lib/cn";

type Outcome = { label: string; tokenId: string; price: number | null; bestBid: number | null; bestAsk: number | null; mid: number | null };
type Market = {
  slug: string; question: string; eventTitle: string | null; image: string | null; endDate: string | null;
  tradable: boolean; resolved: boolean; winner: string | null; fee: { rate: number; exponent: number } | null;
  minOrderSize: number; volume24h: number; outcomes: Outcome[];
};
type Holding = { tokenId: string; outcome: string; shares: number; avgPrice: number; price: number | null; valueUsd: number; pnlUsd: number };
type OrderReply = { order: { status: string; filledShares: number; filledUsd: number; feeUsd: number; error: string | null }; protectionError: string | null };

const feePerShare = (p: number, fee: Market["fee"]) => (fee ? fee.rate * Math.pow(p * (1 - p), fee.exponent) : 0);
const toCents = (v: string) => Number(v);

export default function MarketPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { status } = useSession();
  const signedIn = status === "authenticated";
  const { data: me } = useMe(signedIn);
  const mode: Mode = me?.mode ?? "PAPER";

  const market = useQuery({
    queryKey: ["market", slug],
    queryFn: () => api<{ market: Market }>(`/api/markets/${slug}`).then((r) => r.market),
    refetchInterval: 10_000,
  });
  const portfolio = useQuery({
    queryKey: ["portfolio", mode],
    queryFn: () => api<{ holdings: Holding[]; cashUsd: number }>(`/api/portfolio?mode=${mode}`),
    enabled: signedIn && !!me,
  });

  const [pick, setPick] = useState(0);
  const m = market.data;
  const outcome = m?.outcomes[pick];
  const held = portfolio.data?.holdings.filter((h) => m?.outcomes.some((o) => o.tokenId === h.tokenId)) ?? [];

  if (market.isLoading) return <PageShell><Skeleton className="h-10 w-2/3" /><Skeleton className="mt-6 h-72 w-full" /></PageShell>;
  if (market.error || !m) {
    return (
      <PageShell>
        <Notice tone="error">{(market.error as Error)?.message ?? "Market not found."} <Link href="/markets" className="underline">Back to markets</Link></Notice>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Link href="/markets" className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--c-dim)] hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Markets
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0">
          <div className="flex items-start gap-4">
            {m.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.image} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
            )}
            <div className="min-w-0">
              {m.eventTitle && m.eventTitle !== m.question && <p className="c-eyebrow">{m.eventTitle}</p>}
              <h1 className="c-serif mt-2 text-[clamp(1.9rem,4vw,3rem)] leading-[1.02] text-white">{m.question}</h1>
              <p className="mt-2 text-sm text-[var(--c-dim)]">
                {until(m.endDate)} · {m.fee ? `taker fee about ${((feePerShare(0.5, m.fee) / 0.5) * 100).toFixed(1)}% at 50¢, less near 0¢ or 100¢` : "no trading fee"}
              </p>
            </div>
          </div>

          {!m.tradable && (
            <div className="mt-6">
              <Notice tone="warning">{m.resolved ? `This market has resolved: ${m.winner} won.` : "This market isn't accepting orders right now."}</Notice>
            </div>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {m.outcomes.map((o, i) => (
              <button
                key={o.tokenId}
                type="button"
                onClick={() => setPick(i)}
                aria-pressed={pick === i}
                className={cn("c-panel p-5 text-left transition-colors", pick === i ? "!border-[rgba(247,168,207,0.7)]" : "hover:!border-white/25")}
              >
                <p className="text-sm text-[var(--c-dim)]">{o.label}</p>
                <p className="c-serif mt-1 text-5xl leading-none tabular-nums text-white">{cents(o.mid ?? o.price)}</p>
                <p className="mt-3 text-xs text-[var(--c-faint)]">
                  Buy at {cents(o.bestAsk)} · Sell at {cents(o.bestBid)}
                </p>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[var(--c-faint)]">
            A share pays $1 if its outcome wins and $0 if it loses, so the price is the market&rsquo;s probability. Prices refresh every 10 seconds.
          </p>

          {signedIn && held.length > 0 && (
            <HoldingsPanel held={held} mode={mode} market={m} />
          )}
        </div>

        <aside>
          {!signedIn ? (
            <div className="c-panel p-6">
              <h2 className="font-semibold text-white">Trade with a safety net</h2>
              <p className="mt-2 text-sm text-[var(--c-dim)]">Sign in to trade this market with $1,000 of practice money and automatic take-profit and stop-loss.</p>
              <Link href={`/auth/sign-in?callbackUrl=/markets/${slug}`} className="c-btn-primary mt-5 w-full">Sign in to trade</Link>
            </div>
          ) : m.tradable && outcome && me ? (
            <Ticket market={m} outcome={outcome} mode={mode} cashUsd={portfolio.data?.cashUsd ?? null} liveReady={me.live.account && me.live.enabled && !me.live.paused} />
          ) : null}
        </aside>
      </div>
    </PageShell>
  );
}

function ModeBanner({ mode }: { mode: Mode }) {
  return mode === "LIVE" ? (
    <StatusBadge tone="live">Real money</StatusBadge>
  ) : (
    <StatusBadge tone="practice">Practice money</StatusBadge>
  );
}

function Ticket({ market, outcome, mode, cashUsd, liveReady }: { market: Market; outcome: Outcome; mode: Mode; cashUsd: number | null; liveReady: boolean }) {
  const [tab, setTab] = useState<"now" | "entry" | "alert">("now");
  return (
    <div className="c-panel p-5 lg:sticky lg:top-24">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-white">Buy {outcome.label}</h2>
        <ModeBanner mode={mode} />
      </div>
      {mode === "LIVE" && !liveReady && (
        <div className="mt-4"><Notice tone="warning">Live trading isn&rsquo;t ready. <Link href="/account" className="underline">Set up your live wallet</Link>, or switch to Practice.</Notice></div>
      )}
      <div className="c-tabs mt-4 w-full" role="tablist">
        {([["now", "Buy now"], ["entry", "At a price"], ["alert", "TradingView"]] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className="c-tab flex-1 !min-h-9 !px-2 !text-xs">
            {label}
          </button>
        ))}
      </div>
      <div className="mt-5">
        {tab === "now" && <BuyNow market={market} outcome={outcome} mode={mode} cashUsd={cashUsd} />}
        {tab === "entry" && <BuyAtPrice market={market} outcome={outcome} mode={mode} />}
        {tab === "alert" && <AlertSetup market={market} outcome={outcome} mode={mode} />}
      </div>
    </div>
  );
}

function BuyNow({ market, outcome, mode, cashUsd }: { market: Market; outcome: Outcome; mode: Mode; cashUsd: number | null }) {
  const client = useQueryClient();
  const { toast } = useToast();
  const [amount, setAmount] = useState("10");
  const [protect, setProtect] = useState<ProtectDraft>(emptyProtect);
  const [showProtect, setShowProtect] = useState(true);
  const ask = outcome.bestAsk;
  const dollars = Number(amount);
  const estimate = useMemo(() => {
    if (!ask || !(dollars > 0)) return null;
    const unit = ask + feePerShare(ask, market.fee);
    const shares = dollars / unit;
    return { shares, fee: shares * feePerShare(ask, market.fee), payout: shares };
  }, [ask, dollars, market.fee]);
  const problem = !(dollars >= 1) ? "The smallest buy is $1."
    : cashUsd !== null && mode === "PAPER" && dollars > cashUsd + 1e-9 ? `You have ${money(cashUsd)} of practice cash.`
    : !ask ? "Nobody is selling this outcome right now."
    : showProtect ? protectProblem(protect, ask * 100) : null;

  const buy = useMutation({
    mutationFn: () => api<OrderReply>("/api/orders", {
      method: "POST",
      json: {
        requestId: newRequestId(), mode, marketSlug: market.slug, outcome: outcome.label, side: "BUY", amountUsd: dollars,
        ...(showProtect && hasProtect(protect) ? { protect: toProtect(protect) } : {}),
      },
    }),
    onSuccess: (r) => {
      client.invalidateQueries({ queryKey: ["portfolio"] });
      client.invalidateQueries({ queryKey: ["automations"] });
      client.invalidateQueries({ queryKey: ["me"] });
      if (r.order.status === "FILLED" || r.order.status === "PARTIAL") {
        toast({
          variant: "success",
          title: `Bought ${r.order.filledShares.toFixed(2)} ${outcome.label} for ${money(r.order.filledUsd)}`,
          description: r.protectionError ? `But protection wasn't attached: ${r.protectionError}` : showProtect && hasProtect(protect) ? "Protection is on — Zircon will sell for you." : undefined,
        });
        setProtect(emptyProtect);
      } else {
        toast({ variant: "error", title: "Order not filled", description: r.order.error ?? "Nothing was bought." });
      }
    },
    onError: (e) => toast({ variant: "error", title: "Order failed", description: e.message }),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!problem) buy.mutate(); }} className="space-y-4">
      <label className="block">
        <span className="c-label">Amount</span>
        <span className="relative block">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-faint)]">$</span>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} className="c-input !pl-7 text-lg" />
        </span>
        {mode === "PAPER" && cashUsd !== null && <span className="mt-1 block text-xs text-[var(--c-faint)]">{money(cashUsd)} practice cash available</span>}
      </label>

      {estimate && (
        <dl className="grid grid-cols-2 gap-y-1 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm">
          <dt className="text-[var(--c-dim)]">You get about</dt><dd className="text-right text-white tabular-nums">{estimate.shares.toFixed(2)} shares</dd>
          <dt className="text-[var(--c-dim)]">Price</dt><dd className="text-right text-white tabular-nums">{cents(ask)}</dd>
          <dt className="text-[var(--c-dim)]">Fee</dt><dd className="text-right text-white tabular-nums">{money(estimate.fee)}</dd>
          <dt className="text-[var(--c-dim)]">Pays if {outcome.label} wins</dt><dd className="text-right font-medium text-[var(--c-up)] tabular-nums">{money(estimate.payout)}</dd>
        </dl>
      )}

      <div className="rounded-2xl border border-white/10 p-3">
        <label className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm text-white"><ShieldCheck className="h-4 w-4 text-[var(--c-pink)]" /> Protect this position</span>
          <input type="checkbox" checked={showProtect} onChange={(e) => setShowProtect(e.target.checked)} className="h-4 w-4 accent-[var(--c-magenta)]" />
        </label>
        {showProtect && (
          <div className="mt-3">
            <ProtectFields value={protect} onChange={setProtect} trailing={false} />
            <p className="mt-2 text-[11px] leading-snug text-[var(--c-faint)]">Optional. Zircon watches the price and sells for you — even while you sleep.</p>
          </div>
        )}
      </div>

      {problem && dollars > 0 && <p className="text-sm text-[var(--c-down)]">{problem}</p>}
      <button disabled={!!problem || buy.isPending} className={cn("w-full !min-h-12", mode === "LIVE" ? "c-btn-primary !bg-amber-300 !bg-none" : "c-btn-primary")}>
        {buy.isPending ? "Placing order…" : `Buy ${outcome.label} for ${money(dollars || 0)}${mode === "LIVE" ? " — real money" : ""}`}
      </button>
      <p className="text-[11px] leading-snug text-[var(--c-faint)]">Fills at the best available price up to 2¢ above {cents(ask)}; anything that can&rsquo;t fill within that is cancelled, never left hanging.</p>
    </form>
  );
}

function BuyAtPrice({ market, outcome, mode }: { market: Market; outcome: Outcome; mode: Mode }) {
  const client = useQueryClient();
  const { toast } = useToast();
  const now = (outcome.mid ?? outcome.price ?? 0.5) * 100;
  const [amount, setAmount] = useState("10");
  const [when, setWhen] = useState<"below" | "above">("below");
  const [price, setPrice] = useState(String(Math.max(1, Math.round(now - 5))));
  const [protect, setProtect] = useState<ProtectDraft>(emptyProtect);
  const target = toCents(price);
  const problem = !(Number(amount) >= 1) ? "The smallest buy is $1."
    : !(target >= 1 && target <= 99) ? "Pick a price between 1¢ and 99¢."
    : when === "below" && target >= now ? `It's already at ${cents(now / 100)} — pick a lower price, or use Buy now.`
    : when === "above" && target <= now ? `It's already at ${cents(now / 100)} — pick a higher price, or use Buy now.`
    : protectProblem(protect, target);

  const create = useMutation({
    mutationFn: () => api<{ summary: string }>("/api/automations", {
      method: "POST",
      json: {
        mode, kind: "ENTRY", marketSlug: market.slug, outcome: outcome.label,
        config: { amountUsd: Number(amount), when, price: target / 100, ...(hasProtect(protect) ? { thenExit: toProtect(protect) } : {}) },
      },
    }),
    onSuccess: (r) => {
      client.invalidateQueries({ queryKey: ["automations"] });
      toast({ variant: "success", title: "Automation on", description: r.summary });
      setProtect(emptyProtect);
    },
    onError: (e) => toast({ variant: "error", title: "Couldn't create it", description: e.message }),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!problem) create.mutate(); }} className="space-y-4">
      <p className="text-sm text-[var(--c-dim)]">Zircon watches the price and buys the moment it reaches your level. Now: <span className="text-white">{cents(now / 100)}</span>.</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="c-label">Buy when it</span>
          <select value={when} onChange={(e) => setWhen(e.target.value as "below" | "above")} className="c-input">
            <option value="below">drops to</option>
            <option value="above">rises to</option>
          </select>
        </label>
        <label className="block">
          <span className="c-label">Price</span>
          <span className="relative block">
            <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} className="c-input !pr-8" />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--c-faint)]">¢</span>
          </span>
        </label>
      </div>
      <label className="block">
        <span className="c-label">Spend</span>
        <span className="relative block">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-faint)]">$</span>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} className="c-input !pl-7" />
        </span>
      </label>
      <div>
        <p className="c-label">Then protect it (optional)</p>
        <ProtectFields value={protect} onChange={setProtect} />
      </div>
      {problem && <p className="text-sm text-[var(--c-down)]">{problem}</p>}
      <button disabled={!!problem || create.isPending} className="c-btn-primary w-full">{create.isPending ? "Saving…" : "Start watching"}</button>
    </form>
  );
}

function AlertSetup({ market, outcome, mode }: { market: Market; outcome: Outcome; mode: Mode }) {
  const client = useQueryClient();
  const { toast } = useToast();
  const [amount, setAmount] = useState("10");
  const [max, setMax] = useState("90");
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const problem = !(Number(amount) >= 1) ? "The smallest buy is $1." : !(Number(max) >= 1 && Number(max) <= 99) ? "Max price must be 1–99¢." : null;

  const create = useMutation({
    mutationFn: () => api<{ webhookUrl: string }>("/api/automations", {
      method: "POST",
      json: { mode, kind: "WEBHOOK", marketSlug: market.slug, outcome: outcome.label, config: { amountUsd: Number(amount), maxPrice: Number(max) / 100 } },
    }),
    onSuccess: (r) => { setUrl(r.webhookUrl); client.invalidateQueries({ queryKey: ["automations"] }); },
    onError: (e) => toast({ variant: "error", title: "Couldn't create the webhook", description: e.message }),
  });

  if (url) {
    return (
      <div className="space-y-4">
        <Notice tone="success">Webhook ready. Copy it now — for your security it&rsquo;s only shown once.</Notice>
        <div className="flex gap-2">
          <input readOnly value={url} className="c-input c-mono !text-xs" onFocus={(e) => e.target.select()} />
          <button type="button" onClick={() => { navigator.clipboard.writeText(url); setCopied(true); }} className="c-btn-ghost shrink-0" aria-label="Copy webhook URL">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--c-dim)]">
          <li>In TradingView, create an alert on your strategy.</li>
          <li>Under <b className="text-white">Notifications</b>, turn on <b className="text-white">Webhook URL</b> and paste the link.</li>
          <li>Set the message to:<code className="c-mono mt-1 block rounded-lg bg-black/40 px-2 py-1.5 text-xs text-[var(--c-pink)]">{`{"action": "{{strategy.order.action}}"}`}</code></li>
        </ol>
        <p className="text-xs text-[var(--c-faint)]">A “buy” alert buys ${amount} of {outcome.label} (never above {max}¢). A “sell” alert sells everything you hold of it.</p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!problem) create.mutate(); }} className="space-y-4">
      <p className="text-sm text-[var(--c-dim)]">Send your TradingView strategy&rsquo;s buy and sell alerts straight to this market.</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="c-label">Spend per buy</span>
          <span className="relative block">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-faint)]">$</span>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} className="c-input !pl-7" />
          </span>
        </label>
        <label className="block">
          <span className="c-label">Never pay over</span>
          <span className="relative block">
            <input inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value.replace(/[^0-9.]/g, ""))} className="c-input !pr-8" />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--c-faint)]">¢</span>
          </span>
        </label>
      </div>
      {problem && <p className="text-sm text-[var(--c-down)]">{problem}</p>}
      <button disabled={!!problem || create.isPending} className="c-btn-primary w-full">{create.isPending ? "Creating…" : "Create webhook"}</button>
    </form>
  );
}

function HoldingsPanel({ held, mode, market }: { held: Holding[]; mode: Mode; market: Market }) {
  return (
    <section className="c-panel mt-6 p-5">
      <h2 className="font-semibold text-white">Your position</h2>
      <ul className="mt-3 space-y-3">
        {held.map((h) => <HoldingRow key={h.tokenId} holding={h} mode={mode} market={market} />)}
      </ul>
    </section>
  );
}

function HoldingRow({ holding: h, mode, market }: { holding: Holding; mode: Mode; market: Market }) {
  const client = useQueryClient();
  const { toast } = useToast();
  const [protecting, setProtecting] = useState(false);
  const [protect, setProtect] = useState<ProtectDraft>(emptyProtect);
  const problem = protectProblem(protect) ?? (hasProtect(protect) ? null : "Set at least one level.");

  const sell = useMutation({
    mutationFn: () => api<OrderReply>("/api/orders", { method: "POST", json: { requestId: newRequestId(), mode, marketSlug: market.slug, outcome: h.outcome, side: "SELL", sellPercent: 100 } }),
    onSuccess: (r) => {
      client.invalidateQueries({ queryKey: ["portfolio"] });
      if (r.order.status === "FILLED" || r.order.status === "PARTIAL") toast({ variant: "success", title: `Sold ${r.order.filledShares.toFixed(2)} shares for ${money(r.order.filledUsd)}` });
      else toast({ variant: "error", title: "Sell not filled", description: r.order.error ?? undefined });
    },
    onError: (e) => toast({ variant: "error", title: "Sell failed", description: e.message }),
  });
  const guard = useMutation({
    mutationFn: () => api<{ summary: string }>("/api/automations", { method: "POST", json: { mode, kind: "EXIT", marketSlug: market.slug, outcome: h.outcome, config: toProtect(protect) } }),
    onSuccess: (r) => { client.invalidateQueries({ queryKey: ["automations"] }); toast({ variant: "success", title: "Protection on", description: r.summary }); setProtecting(false); setProtect(emptyProtect); },
    onError: (e) => toast({ variant: "error", title: "Couldn't protect it", description: e.message }),
  });

  return (
    <li className="rounded-2xl border border-white/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-white">{h.shares.toFixed(2)} <span className="text-[var(--c-dim)]">{h.outcome} shares</span></p>
          <p className="text-xs text-[var(--c-faint)]">avg {cents(h.avgPrice)} → now {cents(h.price)} · worth {money(h.valueUsd)} · <span className={h.pnlUsd >= 0 ? "text-[var(--c-up)]" : "text-[var(--c-down)]"}>{money(h.pnlUsd, true)}</span></p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setProtecting((v) => !v)} className="c-btn-ghost c-btn-sm"><ShieldCheck className="h-3.5 w-3.5" /> Protect</button>
          <button onClick={() => { if (confirm(`Sell all ${h.shares.toFixed(2)} ${h.outcome} shares at market${mode === "LIVE" ? " for real money" : ""}?`)) sell.mutate(); }} disabled={sell.isPending} className="c-btn-ghost c-btn-sm">
            {sell.isPending ? "Selling…" : "Sell all"}
          </button>
        </div>
      </div>
      {protecting && (
        <form onSubmit={(e) => { e.preventDefault(); if (!problem) guard.mutate(); }} className="mt-4 space-y-3 border-t border-white/10 pt-4">
          <ProtectFields value={protect} onChange={setProtect} />
          {hasProtect(protect) && problem && <p className="text-sm text-[var(--c-down)]">{problem}</p>}
          <button disabled={!!problem || guard.isPending} className="c-btn-primary c-btn-sm">{guard.isPending ? "Saving…" : "Turn on protection"}</button>
        </form>
      )}
    </li>
  );
}
