"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Copy, Loader2, PauseCircle, ShieldCheck, Zap } from "lucide-react";
import CashOut from "@/components/wallet/cash-out";
import { EmptyState, Notice, PageHeader, PageShell, StatusBadge } from "@/components/ui/page";
import Skeleton from "@/components/ui/skeleton";

type Account = { id: string; provider: string; status: string; liveEnabled: boolean; dailyLimitUsd: number; lastError: string | null };
type Deposit = { depositAddress: string; networks: { chainId: string; chainName: string; minUsd: number }[]; transfers: { status: string; amountUsd: number | null; explorerUrl: string | null }[] };
type Readiness = { balance: string; readiness: string };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed. Try again.");
  return data as T;
}

export default function WalletPage() {
  const { status } = useSession();
  const client = useQueryClient();
  const [loaded, setLoaded] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [configured, setConfigured] = useState(true);
  const [deposit, setDeposit] = useState<Deposit | null>(null);
  const [balance, setBalance] = useState(0);
  const [limit, setLimit] = useState("100");
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (status !== "authenticated") return;
    try {
      const data = await request<{ account: Account | null; configured: boolean }>("/api/wallet/account");
      setAccount(data.account);
      setConfigured(data.configured);
      if (data.account) {
        setLimit(String(data.account.dailyLimitUsd));
        const [d, r] = await Promise.all([
          request<Deposit>("/api/wallet/deposit").catch(() => null),
          request<Readiness>("/api/polymarket/readiness").catch(() => null),
        ]);
        if (d) setDeposit(d);
        if (r) setBalance(Number(r.balance));
      }
      void client.invalidateQueries({ queryKey: ["wallet-summary"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load your account.");
    } finally {
      setLoaded(true);
    }
  }, [status, client]);

  useEffect(() => { void load(); }, [load]);

  async function createAccount() {
    setBusy("create"); setError("");
    try {
      await request("/api/wallet/account", { method: "POST" });
      setNotice("Your trading account is ready. Add funds to begin.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Account creation failed."); }
    finally { setBusy(null); }
  }

  async function saveLimit() {
    setBusy("limit"); setError("");
    try {
      await request("/api/wallet/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dailyLimitUsd: Number(limit) }) });
      setNotice("Daily limit saved.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save your limit."); }
    finally { setBusy(null); }
  }

  async function toggleLive() {
    setBusy("live"); setError("");
    try {
      if (account?.liveEnabled) {
        await request("/api/wallet/account", { method: "DELETE" });
        setNotice("Live trading paused. Practice mode is still available.");
      } else {
        await request("/api/wallet/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ liveEnabled: true }) });
        setNotice("Live trading is on.");
      }
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not update live trading."); }
    finally { setBusy(null); }
  }

  async function copyAddress() {
    if (!deposit) return;
    await navigator.clipboard.writeText(deposit.depositAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  if (status === "unauthenticated") {
    return (
      <PageShell width="narrow">
        <EmptyState
          title="Your trading wallet"
          body="Sign in to create a private Polymarket trading account for your bots. No seed phrase, ever."
          action={<Link href="/auth/sign-in?callbackUrl=/wallet" className="c-btn-primary">Sign in <ArrowRight className="h-4 w-4" /></Link>}
        />
      </PageShell>
    );
  }

  return (
    <PageShell width="medium">
      <PageHeader
        eyebrow="Fuel tank"
        title="Trading"
        accent="wallet."
        description="A private account your bots trade from. You never see or handle a private key."
      />

      <div className="space-y-5">
        {!loaded ? (
          <Skeleton className="h-72" />
        ) : !account ? (
          <section className="c-panel relative overflow-hidden p-8 text-center sm:p-12">
            <div aria-hidden="true" className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(224,97,159,0.3),transparent)]" />
            <ShieldCheck className="relative mx-auto h-9 w-9 text-[var(--c-pink)]" />
            <h2 className="c-serif relative mt-4 text-4xl text-white">Create your trading account</h2>
            <p className="relative mx-auto mt-3 max-w-md text-[var(--c-dim)]">One private wallet, created just for you. Practice mode never needs it — live trades do.</p>
            {!configured && <div className="relative mx-auto mt-5 max-w-md"><Notice tone="warning">Not available on this deployment yet.</Notice></div>}
            <button onClick={createAccount} disabled={busy !== null || !configured} className="c-btn-primary relative mt-7">
              {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {busy === "create" ? "Creating…" : "Create account"}
            </button>
          </section>
        ) : (
          <>
            <section className="c-panel relative overflow-hidden p-7 sm:p-9">
              <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(146,119,245,0.35),transparent)]" />
              <div className="relative flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="c-eyebrow">Balance</p>
                  <p className="c-serif mt-3 text-6xl leading-none tabular-nums text-white sm:text-7xl">${balance.toFixed(2)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {balance > 0 ? <StatusBadge tone="active">Funded</StatusBadge> : <StatusBadge tone="paused">Needs funds</StatusBadge>}
                  {account.liveEnabled ? <StatusBadge tone="live" pulse>Live trading on</StatusBadge> : <StatusBadge tone="practice">Live trading off</StatusBadge>}
                </div>
              </div>

              <div className="relative mt-8 border-t border-white/10 pt-6">
                <p className="c-label">Deposit address</p>
                {deposit ? (
                  <>
                    <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-black/30 py-2 pl-4 pr-2">
                      <code className="c-mono min-w-0 flex-1 truncate text-sm text-white">{deposit.depositAddress}</code>
                      <button onClick={copyAddress} className="c-btn-ghost c-btn-sm shrink-0">
                        {copied ? <Check className="h-3.5 w-3.5 text-[var(--c-up)]" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-[var(--c-dim)]">
                      Send USDC, ETH or most common tokens from {deposit.networks.map(n => n.chainName).join(", ")}.
                      It converts automatically — same address either way. Minimum around ${Math.min(...deposit.networks.map(n => n.minUsd), 3)}.
                    </p>
                    {deposit.transfers.length > 0 && (
                      <ul className="mt-4 divide-y divide-white/5 rounded-2xl border border-white/10">
                        {deposit.transfers.map((t, i) => (
                          <li key={i} className="flex items-center justify-between px-4 py-2.5 text-sm text-[var(--c-dim)]">
                            <span className="capitalize">{t.status.toLowerCase()}{t.amountUsd != null ? ` · $${t.amountUsd.toFixed(2)}` : ""}</span>
                            {t.explorerUrl && <a href={t.explorerUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--c-pink)] hover:underline">View</a>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <Skeleton className="h-12" />
                )}
              </div>
            </section>

            <section className="c-panel flex flex-wrap items-center justify-between gap-4 p-6">
              <label className="flex items-center gap-3 text-sm text-[var(--c-dim)]">
                Daily limit
                <span className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-faint)]">$</span>
                  <input value={limit} onChange={e => setLimit(e.target.value)} onBlur={saveLimit} type="number" min="1" max="10000" step="1" className="c-input !w-32 !pl-7 tabular-nums" />
                </span>
                {busy === "limit" && <Loader2 className="h-4 w-4 animate-spin" />}
              </label>
              <button onClick={toggleLive} disabled={busy !== null} className={account.liveEnabled ? "c-btn-ghost" : "c-btn-primary"}>
                {busy === "live" ? <Loader2 className="h-4 w-4 animate-spin" /> : account.liveEnabled ? <PauseCircle className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                {account.liveEnabled ? "Pause live trading" : "Turn on live trading"}
              </button>
              {account.lastError && <p className="w-full text-sm text-rose-700">{account.lastError}</p>}
            </section>

            <CashOut balance={balance} onChanged={() => void load()} />
          </>
        )}

        {error && <Notice tone="error">{error}</Notice>}
        {notice && <Notice tone="success">{notice}</Notice>}
      </div>

      <p className="mt-8 text-xs leading-relaxed text-[var(--c-faint)]">
        Practice mode is always free. Live trades use this balance and can lose money. Subject to Polymarket&rsquo;s regional eligibility and market rules.
      </p>
    </PageShell>
  );
}
