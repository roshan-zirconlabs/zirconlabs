"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Copy, Pause, ShieldCheck, Wallet } from "lucide-react";
import type { BridgeAsset } from "@/lib/polymarket-bridge";
import AccountReadiness from "@/components/wallet/account-readiness";
import CashOut from "@/components/wallet/cash-out";

type Account = { id: string; address: string; provider: string; status: string; liveEnabled: boolean; dailyLimitUsd: number; lastError: string | null };
type Instructions = { destination: string; depositAddress: string; asset: BridgeAsset };
async function request<T>(url: string, init?: RequestInit): Promise<T> { const response = await fetch(url, init); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Request failed. Try again."); return data; }

export default function WalletPage() {
  const { status } = useSession();
  const [account, setAccount] = useState<Account | null>(null);
  const [configured, setConfigured] = useState(true);
  const [assets, setAssets] = useState<BridgeAsset[]>([]);
  const [assetIndex, setAssetIndex] = useState("");
  const [instructions, setInstructions] = useState<Instructions | null>(null);
  const [limit, setLimit] = useState("100");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    if (status !== "authenticated") return;
    try { const data = await request<{ account: Account | null; configured: boolean }>("/api/wallet/account"); setAccount(data.account); setConfigured(data.configured); if (data.account) setLimit(String(data.account.dailyLimitUsd)); } catch (e) { setError(e instanceof Error ? e.message : "Unable to load your account."); }
  }
  useEffect(() => { void load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void request<{ assets: BridgeAsset[] }>("/api/wallet/deposit").then(data => setAssets(data.assets)).catch(() => setError("Funding options are temporarily unavailable.")); }, []);
  async function createAccount() { setBusy(true); setError(""); try { const data = await request<{ account: Account }>("/api/wallet/account", { method: "POST" }); setAccount(data.account); setNotice("Your private trading account is ready. Add funds to begin."); } catch (e) { setError(e instanceof Error ? e.message : "Account creation failed."); } finally { setBusy(false); } }
  async function saveControls() { if (!account) return; setBusy(true); setError(""); try { const data = await request<{ account: Account }>("/api/wallet/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dailyLimitUsd: Number(limit) }) }); setAccount(data.account); setNotice("Safety limit saved."); } catch (e) { setError(e instanceof Error ? e.message : "Could not save your limit."); } finally { setBusy(false); } }
  async function enableLive() { if (!account) return; setBusy(true); setError(""); try { const data = await request<{ account: Account }>("/api/wallet/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ liveEnabled: true }) }); setAccount(data.account); setNotice("Live trading enabled for this account."); } catch (e) { setError(e instanceof Error ? e.message : "Live trading is not available yet."); } finally { setBusy(false); } }
  async function pause() { setBusy(true); try { await request("/api/wallet/account", { method: "DELETE" }); setAccount(a => a ? { ...a, status: "PAUSED", liveEnabled: false } : a); setNotice("Live trading paused. Paper mode is still available."); } catch (e) { setError(e instanceof Error ? e.message : "Could not pause trading."); } finally { setBusy(false); } }
  async function createDeposit() { const asset = assets[Number(assetIndex)]; if (!asset || !account) return; setBusy(true); setError(""); try { setInstructions(await request<Instructions>("/api/wallet/deposit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmedAccountWallet: true, chainId: asset.chainId, tokenAddress: asset.token.address }) })); } catch (e) { setError(e instanceof Error ? e.message : "Deposit instructions unavailable."); } finally { setBusy(false); } }
  async function copy(value: string) { await navigator.clipboard.writeText(value); setNotice("Deposit address copied. Verify the network before sending."); }

  if (status !== "authenticated") return <main className="mx-auto max-w-3xl px-5 py-16"><h1 className="text-3xl font-semibold tracking-tight">Trading account</h1><p className="mt-3 text-slate-600">Sign in to create your private Polymarket trading account.</p><Link className="mt-6 inline-block underline" href="/auth/sign-in?callbackUrl=/wallet">Sign in</Link></main>;
  return <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
    <header className="border-b border-slate-200 pb-7"><p className="text-sm font-medium text-violet-700">Zircon trading account</p><h1 className="mt-2 flex items-center gap-3 text-3xl font-semibold tracking-tight"><Wallet className="h-7 w-7 text-violet-600" />Your account</h1><p className="mt-3 max-w-2xl text-slate-600">A separate account for your automated Polymarket strategies. Zircon protects the signing key with a managed wallet provider; you never paste a seed phrase or learn wallet jargon.</p></header>
    <div className="mt-8 space-y-8">
      {!account ? <section className="rounded-xl border border-violet-200 bg-violet-50/60 p-6"><ShieldCheck className="h-6 w-6 text-violet-700" /><h2 className="mt-3 text-xl font-semibold">Create your trading account</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">One isolated Polygon wallet is created for you. It is not your KeeperHub organization wallet and it is not shared with anyone else.</p>{!configured && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">The server is missing its managed-wallet credentials. An administrator must add them before accounts can be created.</p>}<button onClick={createAccount} disabled={busy || !configured} className="cosmic-btn-primary mt-5 px-5 py-3 text-sm disabled:opacity-50">{busy ? "Creating…" : "Create account"}</button></section> : <>
        <section className="grid gap-5 border-b border-slate-200 pb-7 sm:grid-cols-[1fr_auto]"><div><p className="text-sm text-slate-500">Trading address</p><p className="mt-2 break-all font-mono text-sm">{account.address}</p><p className="mt-3 text-sm text-slate-600">Status: <span className="font-medium text-emerald-700">{account.status.toLowerCase()}</span> · Provider-secured</p></div><button onClick={pause} disabled={busy || account.status === "PAUSED"} className="inline-flex h-fit items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm"><Pause className="h-4 w-4" />Pause live trading</button></section>
        <section className="space-y-4"><h2 className="text-lg font-semibold">Add funds</h2><p className="text-sm leading-6 text-slate-600">Choose where you are sending funds from. The bridge converts the supported asset into Polymarket collateral and routes it to your account automatically.</p><select value={assetIndex} onChange={e => setAssetIndex(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm"><option value="">Choose a network and token</option>{assets.map((a, i) => <option key={`${a.chainId}-${a.token.address}`} value={i}>{a.chainName} — {a.token.symbol} · minimum ${a.minCheckoutUsd}</option>)}</select><button onClick={createDeposit} disabled={busy || !assetIndex} className="cosmic-btn-primary px-5 py-3 text-sm disabled:opacity-50">{busy ? "Preparing…" : "Show funding address"}</button>{instructions && <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-5"><p className="font-semibold">Send {instructions.asset.token.symbol} on {instructions.asset.chainName}</p><p className="mt-2 text-sm">Minimum ${instructions.asset.minCheckoutUsd} equivalent. This address is a bridge deposit address, not a different account.</p><code className="mt-4 block break-all rounded bg-white p-3 text-xs">{instructions.depositAddress}</code><button onClick={() => copy(instructions.depositAddress)} className="mt-3 inline-flex items-center gap-2 text-sm text-violet-700"><Copy className="h-4 w-4" />Copy address</button><p className="mt-3 break-all text-xs text-slate-600">Destination account: {instructions.destination}</p></div>}</section>
        <section className="space-y-4 border-t border-slate-200 pt-7"><h2 className="text-lg font-semibold">Automation safety</h2><p className="text-sm leading-6 text-slate-600">Paper mode is always available. Live bots are off until you explicitly enable them after funding and reviewing a strategy.</p><label className="block text-sm font-medium">Daily spend limit (USD)<input value={limit} onChange={e => setLimit(e.target.value)} type="number" min="1" max="10000" step="1" className="mt-2 block w-48 rounded-lg border border-slate-300 p-3" /></label><div className="flex flex-wrap gap-3"><button onClick={saveControls} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm disabled:opacity-50">Save limit</button><button onClick={enableLive} disabled={busy || account.liveEnabled || account.status === "PAUSED"} className="cosmic-btn-primary px-4 py-2.5 text-sm disabled:opacity-50">{account.liveEnabled ? "Live trading enabled" : "Enable live trading"}</button></div>{account.lastError && <p role="alert" className="text-sm text-red-700">{account.lastError}</p>}</section>
      </>}
      {account && <AccountReadiness />}
      {account && <CashOut onChanged={() => void load()} />}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p>}{notice && <p role="status" className="text-sm text-violet-700">{notice}</p>}
      <p className="border-t border-slate-200 pt-6 text-xs leading-5 text-slate-500">KeeperHub remains a separate workflow execution connection for its supported plugins. Polymarket accounts are subject to regional eligibility, market rules and the provider’s security policies.</p>
    </div>
  </main>;
}
