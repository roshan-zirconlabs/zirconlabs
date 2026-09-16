"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";

type Readiness = { readiness: string; balance: string; checkedAt: string };

export default function AccountReadiness() {
  const [data, setData] = useState<Readiness | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const check = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/polymarket/readiness", { cache: "no-store" });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Account check failed.");
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Account check unavailable.");
    } finally { setBusy(false); }
  }, []);

  useEffect(() => { void check(); }, [check]);

  const funded = data ? Number(data.balance) > 0 : false;

  return (
    <section className="space-y-4 border-t border-slate-200 pt-6">
      <h2 className="text-lg font-semibold">Ready to trade for real?</h2>
      <p className="text-sm text-slate-600">
        Practice bots work right away. For real money, your trading account just needs collateral —
        no gas token and no approvals to manage. Trades settle through Polymarket&rsquo;s gasless relayer.
      </p>
      <div className="flex items-start gap-2.5 text-sm">
        {funded
          ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />}
        <span>
          <span className={`block font-medium ${funded ? "text-slate-900" : "text-slate-600"}`}>
            {funded ? "Funded and ready" : "Add funds to start"}
          </span>
          <span className="block text-xs text-slate-500">
            {data ? `${Number(data.balance).toFixed(2)} pUSD in your trading account` : "Not checked yet"}
          </span>
        </span>
      </div>
      <div className="flex flex-wrap gap-3">
        <button onClick={() => void check()} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm disabled:opacity-50">
          {busy ? "Checking…" : "Re-check"}
        </button>
      </div>
      {data && <p className="text-xs text-slate-500">Checked {new Date(data.checkedAt).toLocaleTimeString()}. Market rules and eligibility are checked again at order time.</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <Link href="/trade" className="block text-sm underline">Choose a market and preview an order</Link>
    </section>
  );
}
