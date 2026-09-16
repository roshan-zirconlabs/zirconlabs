"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Check, Copy, Loader2, PauseCircle, ShieldCheck, Wallet } from "lucide-react";
import CashOut from "@/components/wallet/cash-out";

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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load your account.");
    }
  }, [status]);

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

  if (status !== "authenticated") {
    return (
      <main className="mx-auto max-w-md px-5 py-20 text-center">
        <Wallet className="mx-auto h-8 w-8 text-violet-600" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Wallet</h1>
        <p className="mt-2 text-sm text-slate-600">Sign in to create your Polymarket trading account.</p>
        <Link href="/auth/sign-in?callbackUrl=/wallet" className="mt-5 inline-block cosmic-btn-primary px-5 py-2.5 text-sm">Sign in</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Wallet</h1>
      <p className="mt-1 text-sm text-slate-500">A private trading account for your bots. No seed phrase, ever.</p>

      <div className="mt-7 space-y-4">
        {!account ? (
          <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-7 text-center">
            <ShieldCheck className="mx-auto h-7 w-7 text-violet-600" />
            <h2 className="mt-3 text-lg font-semibold text-slate-900">Create your trading account</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">One private wallet, created just for you. You never see or handle a private key.</p>
            {!configured && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Not available on this deployment yet.</p>}
            <button onClick={createAccount} disabled={busy !== null || !configured} className="mt-5 cosmic-btn-primary px-5 py-2.5 text-sm disabled:opacity-50">
              {busy === "create" ? "Creating…" : "Create account"}
            </button>
          </div>
        ) : (
          <>
            {/* Balance + fund, unified */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Balance</div>
                  <div className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">${balance.toFixed(2)}</div>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${balance > 0 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${balance > 0 ? "bg-emerald-500" : "bg-slate-400"}`} />
                  {balance > 0 ? "Funded" : "Needs funds"}
                </span>
              </div>

              <div className="mt-5 border-t border-slate-100 pt-5">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Deposit address</div>
                {deposit ? (
                  <>
                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <code className="min-w-0 flex-1 truncate font-mono text-sm text-slate-800">{deposit.depositAddress}</code>
                      <button onClick={copyAddress} className="flex shrink-0 items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-xs ring-1 ring-slate-200 hover:text-slate-900">
                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <p className="mt-2.5 text-xs leading-5 text-slate-500">
                      Send USDC, ETH or most common tokens from {deposit.networks.map(n => n.chainName).join(", ")}.
                      It converts automatically — same address either way. Minimum around ${Math.min(...deposit.networks.map(n => n.minUsd), 3)}.
                    </p>
                    {deposit.transfers.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {deposit.transfers.map((t, i) => (
                          <li key={i} className="flex items-center justify-between text-xs text-slate-500">
                            <span className="capitalize">{t.status.toLowerCase()}{t.amountUsd != null ? ` · $${t.amountUsd.toFixed(2)}` : ""}</span>
                            {t.explorerUrl && <a href={t.explorerUrl} target="_blank" rel="noopener noreferrer" className="underline">view</a>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <div className="mt-2 h-10 animate-pulse rounded-lg bg-slate-100" />
                )}
              </div>
            </div>

            {/* Safety controls, one compact row */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 sm:px-7">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                Daily limit
                <input value={limit} onChange={e => setLimit(e.target.value)} onBlur={saveLimit} type="number" min="1" max="10000" step="1"
                  className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm tabular-nums focus:border-violet-400 focus:outline-none" />
              </label>
              <span className="h-4 w-px bg-slate-200" />
              <button onClick={toggleLive} disabled={busy !== null} className="flex items-center gap-1.5 text-sm font-medium disabled:opacity-50">
                {busy === "live" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : account.liveEnabled ? <PauseCircle className="h-3.5 w-3.5 text-slate-500" /> : <ShieldCheck className="h-3.5 w-3.5 text-violet-600" />}
                <span className={account.liveEnabled ? "text-slate-700" : "text-violet-700"}>{account.liveEnabled ? "Live trading on — pause" : "Turn on live trading"}</span>
              </button>
              {account.lastError && <span className="text-xs text-red-700">{account.lastError}</span>}
            </div>

            <CashOut balance={balance} onChanged={() => void load()} />
          </>
        )}

        {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="text-sm text-violet-700">{notice}</p>}
      </div>

      <p className="mt-8 text-xs leading-5 text-slate-400">Practice mode is always free. Live trades use this balance and can lose money. Subject to Polymarket&rsquo;s regional eligibility and market rules.</p>
    </main>
  );
}
