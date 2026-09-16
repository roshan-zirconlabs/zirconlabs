"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Loader2, Sparkles } from "lucide-react";

type Redeemable = { conditionId: string; title: string | null; size: number };
type Withdrawal = { id: string; destination: string; amountUsd: number; status: string; txHash: string | null; explorerUrl: string | null; createdAt: string };

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "That did not work. Try again.");
  return data as T;
}

export default function CashOut({ balance, onChanged }: { balance: number; onChanged?: () => void }) {
  const [redeemable, setRedeemable] = useState<Redeemable[]>([]);
  const [history, setHistory] = useState<Withdrawal[]>([]);
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const [r, w] = await Promise.all([
        call<{ redeemable: Redeemable[] }>("/api/wallet/redeem"),
        call<{ withdrawals: Withdrawal[] }>("/api/wallet/withdraw"),
      ]);
      setRedeemable(r.redeemable ?? []);
      setHistory(w.withdrawals ?? []);
    } catch { /* Panel still renders; actions report their own errors. */ }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function redeem(position: Redeemable) {
    if (!window.confirm(`Claim your winnings from "${position.title ?? "this market"}"? This converts your winning shares into spendable balance.`)) return;
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
    if (!window.confirm(`Send ${all ? `all ${balance.toFixed(2)}` : amount} to ${destination.trim()}?\n\nDouble-check this address — a transfer on Polygon cannot be reversed.`)) return;

    setBusy("withdraw"); setError(""); setNotice("");
    try {
      const res = await call<{ message: string }>("/api/wallet/withdraw", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: destination.trim(), amount: value, requestId: crypto.randomUUID(), confirm: true }),
      });
      setNotice(res.message);
      setAmount(""); setDestination("");
      await load(); onChanged?.();
    } catch (e) { setError(e instanceof Error ? e.message : "Withdrawal failed."); }
    finally { setBusy(null); }
  }

  const hasContent = redeemable.length > 0 || balance > 0 || history.length > 0;
  if (!hasContent) return null;

  return (
    <section className="c-panel p-6 sm:p-8">
      <h2 className="c-serif text-3xl text-white">Cash out</h2>

      {redeemable.length > 0 && (
        <div className="mt-5 space-y-2">
          {redeemable.map(p => (
            <div key={p.conditionId} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-300/40 bg-emerald-50 px-4 py-3">
              <span className="flex min-w-0 items-center gap-3 text-sm">
                <Sparkles className="h-4 w-4 shrink-0 text-[var(--c-up)]" />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-white">{p.title ?? "Resolved market"}</span>
                  <span className="block text-xs text-[var(--c-dim)]">{p.size.toFixed(2)} winning shares</span>
                </span>
              </span>
              <button onClick={() => void redeem(p)} disabled={busy !== null} className="c-btn-primary c-btn-sm">
                {busy === p.conditionId && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Claim
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="c-label">Send to address</span>
          <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="0x…" spellCheck={false} className="c-input c-mono" />
        </label>
        <label className="sm:w-36">
          <span className="c-label">Amount</span>
          <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="All" inputMode="decimal" className="c-input" />
        </label>
        <button onClick={() => void withdraw()} disabled={busy !== null || !destination.trim() || balance <= 0} className="c-btn-ghost">
          {busy === "withdraw" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
          Withdraw
        </button>
      </div>
      <p className="mt-2.5 text-xs text-[var(--c-faint)]">Leave amount blank to send your full balance. Transfers on Polygon can&rsquo;t be reversed.</p>

      {history.length > 0 && (
        <ul className="mt-6 divide-y divide-white/5 rounded-2xl border border-white/10">
          {history.slice(0, 4).map(w => (
            <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs text-[var(--c-dim)]">
              <span className="c-mono">{w.destination.slice(0, 8)}…{w.destination.slice(-6)}</span>
              <span className="c-mono">${w.amountUsd.toFixed(2)}</span>
              <span className={w.status === "SENT" ? "text-[var(--c-up)]" : w.status === "FAILED" ? "text-[var(--c-down)]" : "text-amber-700"}>{w.status.toLowerCase()}</span>
              {w.explorerUrl ? <a href={w.explorerUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--c-pink)] hover:underline">View</a> : <span />}
            </li>
          ))}
        </ul>
      )}

      {notice && <p role="status" className="mt-4 text-sm text-[var(--c-up)]">{notice}</p>}
      {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}
    </section>
  );
}
