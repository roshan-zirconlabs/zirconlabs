"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowUpRight, Loader2 } from "lucide-react";

type Redeemable = { conditionId: string; title: string | null; size: number };
type Withdrawal = { id: string; destination: string; amountUsd: number; status: string; txHash: string | null; explorerUrl: string | null; createdAt: string };

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "That did not work. Try again.");
  return data as T;
}

export default function CashOut({ onChanged }: { onChanged?: () => void }) {
  const [balance, setBalance] = useState("0");
  const [redeemable, setRedeemable] = useState<Redeemable[]>([]);
  const [history, setHistory] = useState<Withdrawal[]>([]);
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const [r, w, readiness] = await Promise.all([
        call<{ redeemable: Redeemable[] }>("/api/wallet/redeem"),
        call<{ withdrawals: Withdrawal[] }>("/api/wallet/withdraw"),
        call<{ balance: string }>("/api/polymarket/readiness"),
      ]);
      setRedeemable(r.redeemable ?? []);
      setHistory(w.withdrawals ?? []);
      setBalance(readiness.balance ?? "0");
    } catch { /* The panel still renders; the actions report their own errors. */ }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function redeem(position: Redeemable) {
    if (!window.confirm(`Claim your winnings from “${position.title ?? "this market"}”?\n\nThis converts your winning shares into spendable collateral.`)) return;
    setBusy(position.conditionId); setError(""); setNotice("");
    try {
      const res = await call<{ message: string }>("/api/wallet/redeem", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conditionId: position.conditionId, confirm: true }),
      });
      setNotice(res.message);
      await load(); onChanged?.();
    } catch (e) { setError(e instanceof Error ? e.message : "Redemption failed."); }
    finally { setBusy(null); }
  }

  async function withdraw() {
    const all = amount.trim() === "" || amount.trim().toLowerCase() === "all";
    const value = all ? "all" : Number(amount);
    if (!all && (!Number.isFinite(value as number) || (value as number) <= 0)) {
      setError("Enter an amount greater than zero, or leave it blank to withdraw everything.");
      return;
    }
    if (!window.confirm(
      `Send ${all ? `all ${balance}` : amount} pUSD to:\n\n${destination.trim()}\n\nCheck this address carefully. A transfer on Polygon cannot be reversed.`
    )) return;

    setBusy("withdraw"); setError(""); setNotice("");
    try {
      const res = await call<{ message: string; explorerUrl: string | null }>("/api/wallet/withdraw", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: destination.trim(), amount: value, requestId: crypto.randomUUID(), confirm: true }),
      });
      setNotice(res.message);
      setAmount(""); setDestination("");
      await load(); onChanged?.();
    } catch (e) { setError(e instanceof Error ? e.message : "Withdrawal failed."); }
    finally { setBusy(null); }
  }

  return (
    <section className="space-y-5 border-t border-slate-200 pt-6">
      <div>
        <h2 className="text-lg font-semibold">Cash out</h2>
        <p className="mt-1 text-sm text-slate-600">
          Your money is yours. Claim settled winnings, then send your balance to any wallet you choose.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-slate-800">1 · Claim settled winnings</h3>
        {redeemable.length === 0 ? (
          <p className="text-xs text-slate-500">
            Nothing to claim. Winnings appear here once a market you traded has resolved.
          </p>
        ) : (
          redeemable.map(p => (
            <div key={p.conditionId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
              <span className="min-w-0 text-sm">
                <span className="block truncate font-medium text-slate-900">{p.title ?? "Resolved market"}</span>
                <span className="block text-xs text-slate-500">{p.size.toFixed(2)} shares</span>
              </span>
              <button onClick={() => void redeem(p)} disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50">
                {busy === p.conditionId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Claim winnings
              </button>
            </div>
          ))
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-800">2 · Send your balance out</h3>
        <p className="text-xs text-slate-500">Available: <strong>{Number(balance).toFixed(2)} pUSD</strong> on Polygon.</p>
        <label className="block text-sm">
          <span className="text-xs font-medium text-slate-700">Send to wallet address</span>
          <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="0x…" spellCheck={false}
            className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-mono text-sm" />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-medium text-slate-700">Amount (leave blank to send everything)</span>
          <input value={amount} onChange={e => setAmount(e.target.value)} placeholder={`All (${Number(balance).toFixed(2)})`} inputMode="decimal"
            className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm sm:w-56" />
        </label>
        <p className="flex items-start gap-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Double-check the address. A transfer on Polygon cannot be reversed, and this sends pUSD on Polygon — not to an exchange expecting a different network.
        </p>
        <button onClick={() => void withdraw()} disabled={busy !== null || !destination.trim() || Number(balance) <= 0}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
          {busy === "withdraw" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
          {busy === "withdraw" ? "Sending…" : "Withdraw"}
        </button>
      </div>

      {history.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-medium text-slate-800">Recent withdrawals</h3>
          {history.map(w => (
            <div key={w.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span className="font-mono">{w.destination.slice(0, 10)}…{w.destination.slice(-6)}</span>
              <span>{w.amountUsd.toFixed(2)} pUSD</span>
              <span className={w.status === "SENT" ? "text-emerald-700" : w.status === "FAILED" ? "text-rose-700" : "text-amber-700"}>{w.status}</span>
              {w.explorerUrl && <a href={w.explorerUrl} target="_blank" rel="noopener noreferrer" className="underline">View</a>}
            </div>
          ))}
        </div>
      )}

      {notice && <p role="status" className="text-sm text-violet-700">{notice}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
