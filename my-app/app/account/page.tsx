"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, OctagonX, Send } from "lucide-react";
import { PageHeader, PageShell, Notice, StatusBadge } from "@/components/ui/page";
import Skeleton from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { api, money, newRequestId, useMe } from "@/lib/client";

type AccountView = {
  walletsConfigured: boolean;
  liveAvailable: boolean;
  account: { depositWallet: string | null; balanceUsd: number | null; liveEnabled: boolean; paused: boolean; dailyLimitUsd: number } | null;
};

function CopyText({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="flex items-center gap-2">
      <code className="c-mono break-all text-xs text-white">{value}</code>
      <button type="button" onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="shrink-0 text-[var(--c-dim)] hover:text-white" aria-label="Copy">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
    </span>
  );
}

export default function AccountPage() {
  const client = useQueryClient();
  const { toast } = useToast();
  const { data: me } = useMe();
  const account = useQuery({ queryKey: ["account"], queryFn: () => api<AccountView>("/api/account"), refetchInterval: 30_000 });
  const refresh = (next?: AccountView) => {
    if (next) client.setQueryData(["account"], next);
    client.invalidateQueries({ queryKey: ["me"] });
  };

  const create = useMutation({
    mutationFn: () => api<AccountView>("/api/account", { method: "POST" }),
    onSuccess: (v) => { refresh(v); toast({ variant: "success", title: "Live wallet created", description: "Deposit to start trading live." }); },
    onError: (e) => toast({ variant: "error", title: "Couldn't create the wallet", description: e.message }),
  });
  const update = useMutation({
    mutationFn: (patch: Partial<{ liveEnabled: boolean; dailyLimitUsd: number; paused: boolean }>) => api<AccountView>("/api/account", { method: "PATCH", json: patch }),
    onSuccess: (v) => refresh(v),
    onError: (e) => toast({ variant: "error", title: "Couldn't save", description: e.message }),
  });

  const a = account.data?.account;

  return (
    <PageShell width="medium">
      <PageHeader eyebrow="Account" title="Wallet & settings" />

      <section className="c-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-white">Live trading</h2>
          {a && (a.paused ? <StatusBadge tone="danger">Paused</StatusBadge> : a.liveEnabled ? <StatusBadge tone="live" pulse>On</StatusBadge> : <StatusBadge tone="paused">Off</StatusBadge>)}
        </div>

        {account.isLoading ? <Skeleton className="mt-4 h-32 w-full" /> : !account.data?.walletsConfigured ? (
          <div className="mt-4"><Notice tone="info">Live wallets aren&rsquo;t configured on this deployment yet. Practice mode works fully.</Notice></div>
        ) : !a ? (
          <div className="mt-4">
            <p className="text-sm leading-relaxed text-[var(--c-dim)]">
              Your live wallet is a Polymarket trading account created for you — no browser extension, no gas fees. Only you can move money out, to an address you choose.
            </p>
            <button onClick={() => create.mutate()} disabled={create.isPending} className="c-btn-primary mt-5">{create.isPending ? "Creating…" : "Create live wallet"}</button>
          </div>
        ) : (
          <div className="mt-5 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[13px] text-[var(--c-dim)]">Balance</p>
                <p className="c-serif mt-1 text-4xl text-white">{a.balanceUsd === null ? "—" : money(a.balanceUsd)}</p>
                {a.balanceUsd === null && <p className="text-xs text-amber-300">Couldn&rsquo;t read the balance right now.</p>}
              </div>
              <div>
                <p className="text-[13px] text-[var(--c-dim)]">Trading wallet</p>
                {a.depositWallet ? <CopyText value={a.depositWallet} /> : <p className="text-sm text-[var(--c-faint)]">Being prepared…</p>}
              </div>
            </div>

            <Deposit />

            <div className="grid gap-4 border-t border-white/10 pt-6 sm:grid-cols-2">
              <label className="flex items-start justify-between gap-4">
                <span>
                  <span className="block text-sm text-white">Allow live trading</span>
                  <span className="block text-xs text-[var(--c-faint)]">{account.data.liveAvailable ? "Required before any real order is placed." : "Not switched on for this deployment yet."}</span>
                </span>
                <input type="checkbox" className="mt-1 h-5 w-5 accent-amber-300" checked={a.liveEnabled} disabled={!account.data.liveAvailable || update.isPending}
                  onChange={(e) => { if (!e.target.checked || confirm("Allow Zircon to place real-money orders from this wallet, including from your automations?")) update.mutate({ liveEnabled: e.target.checked }); }} />
              </label>
              <DailyLimit value={a.dailyLimitUsd} onSave={(v) => update.mutate({ dailyLimitUsd: v })} />
            </div>

            <div className="rounded-2xl border border-rose-300/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-sm text-white"><OctagonX className="h-4 w-4 text-[var(--c-down)]" /> Kill switch</p>
                  <p className="text-xs text-[var(--c-faint)]">Stops every live order and holds live automations until you turn it off.</p>
                </div>
                <button onClick={() => update.mutate({ paused: !a.paused })} disabled={update.isPending} className={a.paused ? "c-btn-primary c-btn-sm" : "c-btn-danger c-btn-sm"}>
                  {a.paused ? "Resume live trading" : "Pause all live trading"}
                </button>
              </div>
            </div>

            <Withdraw balance={a.balanceUsd} />
          </div>
        )}
      </section>

      <Alerts linked={me?.telegram.linked ?? false} configured={me?.telegram.configured ?? false} />
      <Practice cash={me?.paperCashUsd ?? null} />

      <div className="mt-8">
        <button onClick={() => signOut({ callbackUrl: "/" })} className="c-btn-ghost c-btn-sm">Sign out</button>
      </div>
    </PageShell>
  );
}

function DailyLimit({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);
  const n = Number(shown);
  const valid = n >= 1 && n <= 10000;
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (valid) { onSave(n); setDraft(null); } }}>
      <span className="block text-sm text-white">Daily live limit</span>
      <span className="block text-xs text-[var(--c-faint)]">Most you can spend on live buys per day.</span>
      <span className="mt-2 flex gap-2">
        <span className="relative block flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-faint)]">$</span>
          <input inputMode="decimal" value={shown} onChange={(e) => setDraft(e.target.value.replace(/[^0-9.]/g, ""))} className="c-input !pl-7" />
        </span>
        <button disabled={!valid || draft === null} className="c-btn-ghost c-btn-sm">Save</button>
      </span>
    </form>
  );
}

function Deposit() {
  const [open, setOpen] = useState(false);
  const deposit = useQuery({
    queryKey: ["deposit"],
    queryFn: () => api<{ depositAddress: string; networks: { chainId: string; chainName: string; minUsd: number }[]; transfers: { status: string; amountUsd: number | null; explorerUrl: string | null }[] }>("/api/account/deposit"),
    enabled: open,
    refetchInterval: open ? 20_000 : false,
  });
  return (
    <div className="rounded-2xl border border-white/10 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-white">Deposit</p>
          <p className="text-xs text-[var(--c-faint)]">Send USDC (or most major tokens) from Ethereum, Polygon, Base, Arbitrum or Optimism.</p>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="c-btn-ghost c-btn-sm">{open ? "Hide" : "Show address"}</button>
      </div>
      {open && (
        <div className="mt-4 space-y-3">
          {deposit.isLoading && <Skeleton className="h-16 w-full" />}
          {deposit.error && <Notice tone="error">{(deposit.error as Error).message}</Notice>}
          {deposit.data && (
            <>
              <CopyText value={deposit.data.depositAddress} />
              <p className="text-xs leading-relaxed text-[var(--c-faint)]">
                Polymarket&rsquo;s bridge converts what arrives into trading balance, usually within a few minutes.
                {deposit.data.networks.length > 0 && ` Minimums: ${deposit.data.networks.map((n) => `${n.chainName} $${n.minUsd}`).join(" · ")}.`}
                {" "}Only send from a network listed here.
              </p>
              {deposit.data.transfers.length > 0 && (
                <ul className="space-y-1 text-xs">
                  {deposit.data.transfers.map((t, i) => (
                    <li key={i} className="flex justify-between text-[var(--c-dim)]">
                      <span>{t.amountUsd !== null ? money(t.amountUsd) : "Deposit"} — {t.status.toLowerCase()}</span>
                      {t.explorerUrl && <a href={t.explorerUrl} target="_blank" rel="noreferrer" className="underline">view</a>}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Withdraw({ balance }: { balance: number | null }) {
  const client = useQueryClient();
  const { toast } = useToast();
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [requestId, setRequestId] = useState(newRequestId);
  const all = amount.trim().toLowerCase() === "all";
  const n = Number(amount);
  const problem = !/^0x[a-fA-F0-9]{40}$/.test(destination.trim()) ? "Enter a Polygon wallet address (0x…)." : !(all || n > 0) ? 'Enter an amount, or "all".' : balance !== null && !all && n > balance ? "That's more than your balance." : !confirm ? "Tick the box to confirm." : null;
  const send = useMutation({
    mutationFn: () => api<{ status: string; message?: string; error?: string; explorerUrl?: string | null }>("/api/account/withdraw", { method: "POST", json: { destination: destination.trim(), amount: all ? "all" : n, requestId, confirm: true } }),
    onSuccess: (r) => {
      client.invalidateQueries({ queryKey: ["account"] });
      toast({ variant: r.status === "UNKNOWN" ? "error" : "success", title: r.status === "UNKNOWN" ? "Withdrawal outcome unknown" : "Withdrawal sent", description: r.error ?? r.message });
      setAmount(""); setConfirm(false); setRequestId(newRequestId());
    },
    onError: (e) => toast({ variant: "error", title: "Withdrawal failed", description: e.message }),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!problem) send.mutate(); }} className="space-y-3 border-t border-white/10 pt-6">
      <p className="text-sm text-white">Withdraw</p>
      <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Destination address on Polygon (0x…)" className="c-input c-mono !text-sm" />
      <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder='Amount in USD, or "all"' className="c-input" />
      <label className="flex items-start gap-2 text-xs text-[var(--c-dim)]">
        <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5" />
        I&rsquo;ve checked the address. Funds sent to a wrong address can&rsquo;t be recovered.
      </label>
      {destination && amount && problem && <p className="text-sm text-[var(--c-down)]">{problem}</p>}
      <button disabled={!!problem || send.isPending} className="c-btn-ghost">{send.isPending ? "Sending…" : "Withdraw"}</button>
    </form>
  );
}

function Alerts({ linked, configured }: { linked: boolean; configured: boolean }) {
  const client = useQueryClient();
  const { toast } = useToast();
  const link = useMutation({
    mutationFn: () => api<{ url: string }>("/api/telegram/link", { method: "POST" }),
    onSuccess: (r) => window.open(r.url, "_blank", "noopener"),
    onError: (e) => toast({ variant: "error", title: "Couldn't start linking", description: e.message }),
  });
  const unlink = useMutation({
    mutationFn: () => api("/api/telegram/link", { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["me"] }),
  });
  return (
    <section className="c-panel mt-6 p-6">
      <h2 className="font-semibold text-white">Alerts</h2>
      <p className="mt-1 text-sm text-[var(--c-dim)]">Get a Telegram message whenever an automation trades, fails or needs you. Everything also appears in Activity.</p>
      {!configured ? (
        <p className="mt-4 text-xs text-[var(--c-faint)]">Telegram alerts aren&rsquo;t set up on this deployment yet.</p>
      ) : linked ? (
        <div className="mt-4 flex items-center gap-3">
          <StatusBadge tone="active">Connected</StatusBadge>
          <button onClick={() => unlink.mutate()} className="c-btn-ghost c-btn-sm">Disconnect</button>
        </div>
      ) : (
        <button onClick={() => link.mutate()} disabled={link.isPending} className="c-btn-primary c-btn-sm mt-4"><Send className="h-3.5 w-3.5" /> Connect Telegram</button>
      )}
    </section>
  );
}

function Practice({ cash }: { cash: number | null }) {
  const client = useQueryClient();
  const { toast } = useToast();
  const reset = useMutation({
    mutationFn: () => api("/api/me/reset-practice", { method: "POST" }),
    onSuccess: () => { client.invalidateQueries(); toast({ variant: "success", title: "Practice reset to $1,000" }); },
    onError: (e) => toast({ variant: "error", title: "Couldn't reset", description: e.message }),
  });
  return (
    <section className="c-panel mt-6 p-6">
      <h2 className="font-semibold text-white">Practice account</h2>
      <p className="mt-1 text-sm text-[var(--c-dim)]">Real prices and real fees, pretend money. Cash: <span className="text-white">{money(cash)}</span>.</p>
      <button onClick={() => { if (confirm("Reset practice to $1,000? Practice positions and automations are cleared.")) reset.mutate(); }} disabled={reset.isPending} className="c-btn-ghost c-btn-sm mt-4">Reset practice account</button>
    </section>
  );
}
