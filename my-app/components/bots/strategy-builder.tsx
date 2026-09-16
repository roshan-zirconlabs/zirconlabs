"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Loader2, Play, Save, ShieldCheck, Wallet } from "lucide-react";
import Link from "next/link";
import Button from "@/components/ui/button";
import { ASSETS, RULES, TIMEFRAMES } from "@/lib/workflow/strategy";
import PipelinePreview from "@/components/workflow/pipeline-preview";

type Spec = {
  version: 1;
  source: "schedule" | "webhook";
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
  version: 1, source: "schedule", asset: "BTC", timeframe: "15m", rule: "momentum",
  fastPeriod: 9, slowPeriod: 21, stakeUsd: 10, maxPrice: 0.95, mode: "paper",
};

const CADENCE: Record<Spec["timeframe"], string> = {
  "15m": "every 15 minutes", "1h": "once an hour", "4h": "every 4 hours", "1d": "once a day",
};

const fieldClass = "c-input";

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="c-panel p-6 sm:p-7">
      <div className="flex items-start gap-4">
        <span className="c-serif grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 text-xl text-[var(--c-pink)]">{n}</span>
        <div className="min-w-0 flex-1">
          <h2 className="c-serif text-2xl text-white sm:text-3xl">{title}</h2>
          {hint && <p className="mt-1 text-sm leading-relaxed text-[var(--c-dim)]">{hint}</p>}
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </section>
  );
}

function Choice({ name, checked, onChange, title, body, tone = "default" }: { name: string; checked: boolean; onChange: () => void; title: string; body: React.ReactNode; tone?: "default" | "live" }) {
  const on = tone === "live" ? "border-amber-300/50 bg-amber-50" : "border-[rgba(247,168,207,0.45)] bg-[rgba(224,97,159,0.08)]";
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${checked ? on : "border-white/10 hover:border-white/20 hover:bg-white/[0.03]"}`}>
      <input type="radio" name={name} className="mt-1" checked={checked} onChange={onChange} />
      <span>
        <span className="block text-sm font-medium text-white">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-relaxed text-[var(--c-dim)]">{body}</span>
      </span>
    </label>
  );
}

export default function StrategyBuilder({ botId, onSaved }: { botId: string; onSaved?: (wasActive: boolean) => void }) {
  const [spec, setSpec] = useState<Spec>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [alertUrl, setAlertUrl] = useState<string | null>(null);
  const [botStatus, setBotStatus] = useState<string>("INACTIVE");
  const [readiness, setReadiness] = useState<{ funded: boolean; balance: number; hasAccount: boolean; liveEnabled: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/bots/${botId}/strategy`);
        const json = await res.json();
        if (!alive) return;
        if (json.strategy) setSpec({ ...DEFAULTS, ...json.strategy });
        setAlertUrl(json.alertUrl ?? null);
        setBotStatus(json.bot?.status ?? "INACTIVE");
      } catch { /* A new bot simply starts from the defaults. */ }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [botId]);

  useEffect(() => {
    if (spec.mode !== "live") { setReadiness(null); return; }
    let alive = true;
    (async () => {
      try {
        const [acctRes, readyRes] = await Promise.all([
          fetch("/api/wallet/account"), fetch("/api/polymarket/readiness"),
        ]);
        const acct = await acctRes.json().catch(() => ({}));
        const ready = await readyRes.json().catch(() => ({}));
        if (!alive) return;
        const hasAccount = Boolean(acct.account);
        setReadiness({
          hasAccount,
          liveEnabled: Boolean(acct.account?.liveEnabled),
          balance: Number(ready.balance ?? 0),
          funded: Number(ready.balance ?? 0) > 0,
        });
      } catch { if (alive) setReadiness(null); }
    })();
    return () => { alive = false; };
  }, [spec.mode]);

  const set = useCallback(<K extends keyof Spec>(key: K, value: Spec[K]) => {
    setSpec(s => ({ ...s, [key]: value }));
    setDirty(true); setSaved(false); setPreview(null);
  }, []);

  const alertDriven = spec.source === "webhook";
  const usesAverages = !alertDriven && spec.rule === "sma-cross";
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
    const wasActive = botStatus === "ACTIVE";
    try {
      const res = await fetch(`/api/bots/${botId}/strategy`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(spec),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "The strategy could not be saved.");
      setDirty(false); setSaved(true);
      // A 200 with an error means the draft saved but KeeperHub wasn't reached.
      if (json.error) setError(json.error);
      onSaved?.(wasActive);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The strategy could not be saved.");
    } finally { setSaving(false); }
  }

  if (loading) return <div className="c-skeleton h-96" />;

  return (
    <div className="space-y-5">
      <section className="c-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="c-eyebrow">What this actually runs</h2>
          <span className={`c-chip ${spec.mode === "live" ? "border-amber-300/40 bg-amber-50 text-amber-700" : "border-emerald-300/40 bg-emerald-50 text-emerald-700"}`}>
            {spec.mode === "live" ? "Live · real money" : "Practice · simulated"}
          </span>
        </div>
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-3">
          <PipelinePreview spec={spec} />
        </div>
      </section>

      <Step n={1} title="What starts a trade?">
        <div className="space-y-2">
          <Choice name="source" checked={!alertDriven} onChange={() => set("source", "schedule")} title="A schedule" body="Zircon checks the market on a timer and decides using a rule you pick below." />
          <Choice name="source" checked={alertDriven} onChange={() => set("source", "webhook")} title="My own alert (TradingView)" body="Your existing TradingView alert decides. Paste one URL into the alert and your strategy trades the prediction market." />
        </div>
      </Step>

      <Step n={2} title="Which market?" hint="Polymarket runs a fresh “up or down?” market for each window. Your bot finds the open one automatically.">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="c-label">Asset</span>
            <select className={fieldClass} value={spec.asset} onChange={e => set("asset", e.target.value as Spec["asset"])}>
              {ASSETS.map(a => <option key={a} value={a}>{a === "BTC" ? "Bitcoin" : "Ethereum"}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="c-label">How often it trades</span>
            <select className={fieldClass} value={spec.timeframe} onChange={e => set("timeframe", e.target.value as Spec["timeframe"])}>
              {TIMEFRAMES.map(t => <option key={t} value={t}>{CADENCE[t]} ({t} market)</option>)}
            </select>
          </label>
        </div>
      </Step>

      {!alertDriven && (
        <Step n={3} title="How should it decide?">
          <div className="space-y-2">
            {RULES.map(r => (
              <Choice key={r.id} name="rule" checked={spec.rule === r.id} onChange={() => set("rule", r.id)} title={r.label} body={r.help} />
            ))}
          </div>
          {usesAverages && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="c-label">Fast average (candles)</span>
                <input type="number" min={2} max={100} className={fieldClass} value={spec.fastPeriod} onChange={e => set("fastPeriod", Number(e.target.value))} />
              </label>
              <label className="block">
                <span className="c-label">Slow average (candles)</span>
                <input type="number" min={3} max={400} className={fieldClass} value={spec.slowPeriod} onChange={e => set("slowPeriod", Number(e.target.value))} />
                {spec.slowPeriod <= spec.fastPeriod && (
                  <span className="mt-1.5 block text-xs text-rose-700">The slow average must cover more candles than the fast one.</span>
                )}
              </label>
            </div>
          )}
        </Step>
      )}

      <Step n={alertDriven ? 3 : 4} title="How much, and how careful?">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="c-label">Stake per trade (USD)</span>
            <input type="number" min={1} max={100} step={1} className={fieldClass} value={spec.stakeUsd} onChange={e => set("stakeUsd", Number(e.target.value))} />
            <span className="mt-1.5 block text-xs text-[var(--c-faint)]">Between $1 and $100 per run.</span>
          </label>
          <label className="block">
            <span className="c-label">Never pay more than</span>
            <select className={fieldClass} value={spec.maxPrice} onChange={e => set("maxPrice", Number(e.target.value))}>
              {[0.6, 0.7, 0.8, 0.9, 0.95, 0.99].map(p => <option key={p} value={p}>{Math.round(p * 100)}¢ per share</option>)}
            </select>
            <span className="mt-1.5 block text-xs leading-relaxed text-[var(--c-faint)]">
              A share pays $1 if it wins. Paying 60¢ means the market sees a 60% chance. Lower caps skip more runs.
            </span>
          </label>
        </div>
      </Step>

      <Step n={alertDriven ? 4 : 5} title="Practice or real money?">
        <div className="space-y-2">
          <Choice name="mode" checked={spec.mode === "paper"} onChange={() => set("mode", "paper")} title="Practice (recommended)" body="Records what the trade would have cost at the real order book. No money moves." />
          <Choice name="mode" tone="live" checked={spec.mode === "live"} onChange={() => set("mode", "live")} title="Real money" body="Buys real shares from your own funded trading wallet. Checked before every single order — never assumed." />
        </div>

        {spec.mode === "live" && (
          <div className={`mt-4 rounded-2xl border p-4 text-sm ${readiness?.funded && readiness?.liveEnabled ? "border-emerald-300/40 bg-emerald-50" : "border-amber-300/40 bg-amber-50"}`}>
            <p className="flex items-center gap-2 font-medium text-white">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              {readiness === null ? "Checking your trading account…"
                : !readiness.hasAccount ? "No trading account yet"
                : !readiness.funded ? "Trading account has no funds"
                : !readiness.liveEnabled ? "Live trading is off for your account"
                : "Ready — every run re-checks this"}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6 text-xs leading-relaxed text-[var(--c-dim)]">
              <li>Balance{readiness ? `: $${readiness.balance.toFixed(2)}` : ""} — read on-chain by KeeperHub before each order, not assumed from this screen.</li>
              <li>If the balance can&rsquo;t cover the stake, that run is skipped — nothing partial is ever sent.</li>
              <li>Live trading must be turned on for your account, separately from this bot.</li>
            </ul>
            {(!readiness?.hasAccount || !readiness?.funded || !readiness?.liveEnabled) && (
              <Link href="/wallet" className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--c-pink)] hover:underline">
                <Wallet className="h-3.5 w-3.5" /> Open trading wallet
              </Link>
            )}
          </div>
        )}
      </Step>

      <section className="c-panel p-5 sm:p-6">
        <p className="text-sm leading-relaxed text-[var(--c-dim)]"><span className="font-semibold text-white">In plain terms:</span> {sentence}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!alertDriven && (
            <Button type="button" variant="outline" size="sm" onClick={() => void runPreview()} disabled={previewing}>
              {previewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              What would it do right now?
            </Button>
          )}
          <Button type="button" variant="primary" size="sm" onClick={() => void save()} disabled={saving || (!dirty && saved)}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? "Saving…" : saved ? "Saved" : "Save strategy"}
          </Button>
        </div>

        {saved && !dirty && (
          <p role="status" className="mt-3 text-xs text-[var(--c-up)]">
            {botStatus === "ACTIVE"
              ? "This bot is live — the change took effect immediately on KeeperHub. Nothing further to click."
              : "Saved as a draft. This bot is not running yet — turn it on above to publish it to KeeperHub."}
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-rose-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}
          </p>
        )}

        {alertDriven && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm">
            <p className="font-medium text-white">Connecting TradingView</p>
            {alertUrl ? (
              <>
                <p className="mt-2 text-xs text-[var(--c-dim)]">In TradingView, open your alert, tick <span className="font-medium text-white">Webhook URL</span>, and paste this:</p>
                <code className="c-mono mt-2 block break-all rounded-xl bg-black/30 p-3 text-[11px] text-[var(--c-pink)]">{alertUrl}</code>
                <p className="mt-3 text-xs text-[var(--c-dim)]">Then set the alert message to exactly this:</p>
                <code className="c-mono mt-2 block break-all rounded-xl bg-black/30 p-3 text-[11px] text-[var(--c-pink)]">{"{\"action\": \"{{strategy.order.action}}\"}"}</code>
                <p className="mt-3 text-xs leading-relaxed text-[var(--c-dim)]">
                  TradingView sends <span className="c-mono">buy</span> or <span className="c-mono">sell</span>; the bot buys UP or DOWN to match.
                  Repeat alerts inside the same market window are ignored, and every trade stays inside the limits above.
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs text-[var(--c-dim)]">Save this strategy and turn the bot on. Your alert URL appears here once it is published.</p>
            )}
          </div>
        )}

        {preview && (
          <div role="status" className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm">
            {preview.error ? (
              <p className="text-rose-700">{preview.error}</p>
            ) : (
              <>
                <p className="font-medium text-white">
                  {preview.wouldTrade ? `It would buy ${preview.direction} on “${preview.question}”.` : "It would sit this run out."}
                </p>
                {preview.reason && <p className="mt-1 text-xs text-[var(--c-dim)]">{preview.reason}</p>}
                {preview.blocked && <p className="mt-1 text-xs text-amber-700">{preview.blocked}</p>}
                {preview.wouldTrade && preview.estimatedPrice != null && (
                  <p className="mt-1 text-xs text-[var(--c-dim)]">
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
