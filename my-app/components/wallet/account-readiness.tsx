"use client";
import { useState } from "react";
import Link from "next/link";

type Readiness = { balance: string; nativeBalance: string; approvals: { isFullyApproved: boolean; missingCount: number }; checkedAt: string };
export default function AccountReadiness() {
  const [data, setData] = useState<Readiness | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function check() {
    setBusy(true); setError(""); setData(null);
    try { const r = await fetch("/api/polymarket/readiness", { cache: "no-store" }); const body = await r.json(); if (!r.ok) throw new Error(body.error || "Account check failed."); setData(body); }
    catch (e) { setError(e instanceof Error ? e.message : "Account check unavailable."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 border-t border-slate-200 pt-6"><h2 className="text-lg font-semibold">Balance and trading setup</h2><p className="text-sm text-slate-600">After funding, check that your funds have reached this account.</p><button onClick={() => void check()} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-violet-600">{busy ? "Checking account…" : "Check balance and setup"}</button>{data && <div role="status" className="space-y-2 text-sm"><p>Trading balance: <strong>{Number(data.balance).toFixed(2)} pUSD</strong></p><p>Network fee balance: {Number(data.nativeBalance).toFixed(5)} POL</p><p>{data.approvals.isFullyApproved ? "Trading approvals are in place." : `Trading setup is incomplete (${data.approvals.missingCount} approvals required).`}</p><p className="text-xs text-slate-500">Checked {new Date(data.checkedAt).toLocaleTimeString()}. Signing authorization and order eligibility are checked when submitting.</p></div>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<Link href="/trade" className="block text-sm underline">Choose a market and preview an order</Link></section>;
}
