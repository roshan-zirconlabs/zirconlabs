"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Loader2, Play, Save, Wallet } from "lucide-react";
import Link from "next/link";
import Button from "@/components/ui/button";
import { ASSETS, RULES, TIMEFRAMES } from "@/lib/workflow/strategy";

type Spec = {
  version: 1;
  asset: (typeof ASSETS)[number];
  timeframe: (typeof TIMEFRAMES)[number];
  rule: string;
  fastPeriod: number;
  slowPeriod: number;
  stakeUsd: number;
  maxPrice: number;
  mode: "paper" | "live";
};

type Preview = {
  wouldTrade?: boolean;
  direction?: "UP" | "DOWN";
  outcome?: string;
  question?: string;
  marketSlug?: string;
  reason?: string;
  estimatedShares?: number | null;
  estimatedPrice?: number | null;
  blocked?: string | null;
  error?: string;
};

const DEFAULTS: Spec = {
  version: 1, asset: "BTC", timeframe: "15m", rule: "momentum",
  fastPeriod: 9, slowPeriod: 21, stakeUsd: 10, maxPrice: 0.95, mode: "paper",
};

const CADENCE: Record<Spec["timeframe"], string> = {
  "15m": "every 15 minutes", "1h": "once an hour", "4h": "every 4 hours", "1d": "once a day",
};

const fieldClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-purple-400";

export default function StrategyBuilder({ botId, onSaved }: { botId: string; onSaved?: () => void }) {
  const [spec, setSpec] = useState<Spec>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/bots/${botId}/strategy`);
        const json = await res.json();
        if (!alive) return;
        if (json.strategy) setSpec({ ...DEFAULTS, ...json.strategy });
      } catch { /* A new bot simply starts from the defaults. */ }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [botId]);

  const set = useCallback(<K extends keyof Spec>(key: K, value: Spec[K]) => {
    setSpec(s => ({ ...s, [key]: value }));
    setDirty(true); setSaved(false); setPreview(null);
  }, []);

  const usesAverages = spec.rule === "sma-cross";
  const sentence = useMemo(() => {
    const rule = RULES.find(r => r.id === spec.rule);
    return `${CADENCE[spec.timeframe]}, check ${spec.asset} and — using “${rule?.label ?? spec.rule}” — stake $${spec.stakeUsd} on the ${spec.asset} ${spec.timeframe} up/down market, never paying more than ${Math.round(spec.maxPrice * 100)}¢ a share.`;
  }, [spec]);

  async function runPreview() {
    setPreviewing(true); setPreview(null);
    try {
      const res = await fetch(`/api/bots/${botId}/preview`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(spec),
      });
      setPreview(await res.json());
    } catch {
      setPreview({ error: "The preview could not be reached. Check your connection." });
    } finally { setPreviewing(false); }
  }

  async function save() {
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/bots/${botId}/strategy`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(spec),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "The strategy could not be saved.");
      setDirty(false); setSaved(true);
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The strategy could not be saved.");
    } finally { setSaving(false); }
  }

  if (loading) return <div className="h-64 animate-pulse rounded-2xl border border-purple-100 bg-white" />;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-purple-100 bg-white p-5 shadow-xs">
        <h2 className="text-sm font-semibold text-slate-900">1 · What should this bot watch?</h2>
        <p className="mt-1 text-xs text-slate-500">
          Polymarket runs a fresh “will the price be up or down?” market for each window. Your bot finds the open one automatically.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Asset</span>
            <select className={`${fieldClass} mt-1`} value={spec.asset} onChange={e => set("asset", e.target.value as Spec["asset"])}>
              {ASSETS.map(a => <option key={a} value={a}>{a === "BTC" ? "Bitcoin" : "Ethereum"}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700">How often it trades</span>
            <select className={`${fieldClass} mt-1`} value={spec.timeframe} onChange={e => set("timeframe", e.target.value as Spec["timeframe"])}>
              {TIMEFRAMES.map(t => <option key={t} value={t}>{CADENCE[t]} ({t} market)</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-purple-100 bg-white p-5 shadow-xs">
        <h2 className="text-sm font-semibold text-slate-900">2 · How should it decide?</h2>
        <div className="mt-4 space-y-2">
          {RULES.map(r => (
            <label key={r.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${spec.rule === r.id ? "border-purple-300 bg-purple-50/60" : "border-slate-200 hover:bg-slate-50"}`}>
              <input type="radio" name="rule" className="mt-0.5" checked={spec.rule === r.id} onChange={() => set("rule", r.id)} />
              <span>
                <span className="block text-sm font-medium text-slate-900">{r.label}</span>
                <span className="block text-xs text-slate-500">{r.help}</span>
              </span>
            </label>
          ))}
        </div>
        {usesAverages && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Fast average (candles)</span>
              <input type="number" min={2} max={100} className={`${fieldClass} mt-1`} value={spec.fastPeriod} onChange={e => set("fastPeriod", Number(e.target.value))} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Slow average (candles)</span>
              <input type="number" min={3} max={400} className={`${fieldClass} mt-1`} value={spec.slowPeriod} onChange={e => set("slowPeriod", Number(e.target.value))} />
              {spec.slowPeriod <= spec.fastPeriod && (
                <span className="mt-1 block text-xs text-rose-700">The slow average must cover more candles than the fast one.</span>
              )}
            </label>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-purple-100 bg-white p-5 shadow-xs">
        <h2 className="text-sm font-semibold text-slate-900">3 · How much, and how careful?</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Stake per trade (USD)</span>
            <input type="number" min={1} max={100} step={1} className={`${fieldClass} mt-1`} value={spec.stakeUsd} onChange={e => set("stakeUsd", Number(e.target.value))} />
            <span className="mt-1 block text-xs text-slate-500">Between $1 and $100 per run.</span>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Never pay more than</span>
            <select className={`${fieldClass} mt-1`} value={spec.maxPrice} onChange={e => set("maxPrice", Number(e.target.value))}>
              {[0.6, 0.7, 0.8, 0.9, 0.95, 0.99].map(p => <option key={p} value={p}>{Math.round(p * 100)}¢ per share</option>)}
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              A share pays $1 if it wins. Paying 60¢ means the market thinks there is a 60% chance. Lower caps skip more runs.
            </span>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-purple-100 bg-white p-5 shadow-xs">
        <h2 className="text-sm font-semibold text-slate-900">4 · Practice or real money?</h2>
        <div className="mt-4 space-y-2">
          <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${spec.mode === "paper" ? "border-purple-300 bg-purple-50/60" : "border-slate-200"}`}>
            <input type="radio" name="mode" className="mt-0.5" checked={spec.mode === "paper"} onChange={() => set("mode", "paper")} />
            <span>
              <span className="block text-sm font-medium text-slate-900">Practice (recommended)</span>
              <span className="block text-xs text-slate-500">Records what the trade would have cost at the real order book. No money moves.</span>
            </span>
          </label>
          <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${spec.mode === "live" ? "border-amber-300 bg-amber-50/60" : "border-slate-200"}`}>
            <input type="radio" name="mode" className="mt-0.5" checked={spec.mode === "live"} onChange={() => set("mode", "live")} />
            <span>
              <span className="block text-sm font-medium text-slate-900">Real money</span>
              <span className="block text-xs text-slate-500">
                Buys real shares from your own funded trading wallet. Requires a funded account with trading turned on.
              </span>
              <Link href="/wallet" className="mt-1 inline-flex items-center gap-1 text-xs text-purple-700 underline">
                <Wallet className="h-3 w-3" /> Open trading wallet
              </Link>
            </span>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
        <p className="text-sm text-slate-700"><span className="font-semibold">In plain terms:</span> {sentence}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void runPreview()} disabled={previewing}>
            {previewing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
            What would it do right now?
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={() => void save()} disabled={saving || (!dirty && saved)}>
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            {saving ? "Saving…" : saved ? "Saved" : "Save strategy"}
          </Button>
        </div>

        {error && (
          <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-rose-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}
          </p>
        )}

        {preview && (
          <div role="status" className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
            {preview.error ? (
              <p className="text-rose-700">{preview.error}</p>
            ) : (
              <>
                <p className="font-medium text-slate-900">
                  {preview.wouldTrade
                    ? `It would buy ${preview.direction} on “${preview.question}”.`
                    : "It would sit this run out."}
                </p>
                {preview.reason && <p className="mt-1 text-xs text-slate-500">{preview.reason}</p>}
                {preview.blocked && <p className="mt-1 text-xs text-amber-700">{preview.blocked}</p>}
                {preview.wouldTrade && preview.estimatedPrice != null && (
                  <p className="mt-1 text-xs text-slate-500">
                    About {preview.estimatedShares?.toFixed(2)} shares at roughly {Math.round(preview.estimatedPrice * 100)}¢ each.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
