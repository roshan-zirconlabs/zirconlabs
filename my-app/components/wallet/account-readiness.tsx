"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

type Readiness = {
  readiness: string;
  balance: string;
  nativeBalance: string;
  approvals: { isFullyApproved: boolean; missingCount: number };
  checkedAt: string;
};

export default function AccountReadiness() {
  const [data, setData] = useState<Readiness | null>(null);
  const [busy, setBusy] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const check = useCallback(async () => {
    setBusy(true); setError(""); setNotice("");
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

  async function approve() {
    if (!window.confirm(
      "Authorise Polymarket's exchange contracts to settle trades for this wallet?\n\nThis sends on-chain transactions from your own wallet and needs a small amount of POL for gas. It does not move your funds and does not give Zircon custody."
    )) return;
    setApproving(true); setError(""); setNotice("");
    try {
      const r = await fetch("/api/wallet/approvals", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Approvals could not be completed.");
      setData(body.readiness ?? null);
      setNotice(body.alreadyApproved ? "This account was already approved." : "Trading approvals are in place.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approvals could not be completed.");
    } finally { setApproving(false); }
  }

  const funded = data ? Number(data.balance) > 0 : false;
  const hasGas = data ? Number(data.nativeBalance) > 0 : false;
  const approved = data?.approvals.isFullyApproved ?? false;

  return (
    <section className="space-y-4 border-t border-slate-200 pt-6">
      <h2 className="text-lg font-semibold">Ready to trade for real?</h2>
      <p className="text-sm text-slate-600">
        Practice bots work right away. These three steps are only needed before a bot can use real money.
      </p>

      <ol className="space-y-2 text-sm">
        <Step done={funded} label="Funds have arrived" detail={data ? `${Number(data.balance).toFixed(2)} pUSD in the account` : "Not checked yet"} />
        <Step done={hasGas} label="A little POL for network fees" detail={data ? `${Number(data.nativeBalance).toFixed(5)} POL` : "Not checked yet"} />
        <Step done={approved} label="Polymarket is authorised to settle your trades" detail={data ? (approved ? "Approved" : `${data.approvals.missingCount} approvals still needed`) : "Not checked yet"} />
      </ol>

      <div className="flex flex-wrap gap-3">
        <button onClick={() => void check()} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm disabled:opacity-50">
          {busy ? "Checking…" : "Re-check"}
        </button>
        {!approved && (
          <button onClick={() => void approve()} disabled={approving || !hasGas} title={!hasGas ? "Send a small amount of POL to this wallet first" : undefined}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
            {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {approving ? "Authorising…" : "Authorise trading"}
          </button>
        )}
      </div>

      {data && (
        <p className="text-xs text-slate-500">
          Checked {new Date(data.checkedAt).toLocaleTimeString()}. Order eligibility and regional rules are checked again when a trade is submitted.
        </p>
      )}
      {notice && <p role="status" className="text-sm text-violet-700">{notice}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <Link href="/trade" className="block text-sm underline">Choose a market and preview an order</Link>
    </section>
  );
}

function Step({ done, label, detail }: { done: boolean; label: string; detail: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${done ? "text-emerald-600" : "text-slate-300"}`} />
      <span>
        <span className={`block font-medium ${done ? "text-slate-900" : "text-slate-600"}`}>{label}</span>
        <span className="block text-xs text-slate-500">{detail}</span>
      </span>
    </li>
  );
}
