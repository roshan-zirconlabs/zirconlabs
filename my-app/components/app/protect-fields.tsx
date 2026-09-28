"use client";

/**
 * Take-profit / stop-loss / trailing-stop inputs, entered in cents (1–99) —
 * the unit Polymarket shows. Converted to prices by `toProtect`.
 */

export type ProtectDraft = { takeProfit: string; stopLoss: string; trailing: string };
export const emptyProtect: ProtectDraft = { takeProfit: "", stopLoss: "", trailing: "" };

export function toProtect(d: ProtectDraft) {
  const c = (v: string) => (v.trim() === "" ? undefined : Number(v));
  const tp = c(d.takeProfit);
  const sl = c(d.stopLoss);
  const tr = c(d.trailing);
  const out: { takeProfit?: number; stopLoss?: number; trailingCents?: number } = {};
  if (tp !== undefined) out.takeProfit = tp / 100;
  if (sl !== undefined) out.stopLoss = sl / 100;
  if (tr !== undefined) out.trailingCents = Math.round(tr);
  return out;
}

/** Returns a readable problem, or null when the draft is usable. */
export function protectProblem(d: ProtectDraft, entryCents?: number): string | null {
  const p = toProtect(d);
  const inRange = (v?: number) => v === undefined || (v >= 0.01 && v <= 0.99);
  if (!inRange(p.takeProfit) || !inRange(p.stopLoss)) return "Prices must be between 1¢ and 99¢.";
  if (p.trailingCents !== undefined && (p.trailingCents < 1 || p.trailingCents > 50)) return "Trailing stop must be 1–50¢.";
  if (p.takeProfit !== undefined && p.stopLoss !== undefined && p.takeProfit <= p.stopLoss) return "Take-profit must be above stop-loss.";
  if (entryCents !== undefined && p.takeProfit !== undefined && p.takeProfit * 100 <= entryCents) return "Take-profit should be above the price you're buying at.";
  if (entryCents !== undefined && p.stopLoss !== undefined && p.stopLoss * 100 >= entryCents) return "Stop-loss should be below the price you're buying at.";
  return null;
}

export const hasProtect = (d: ProtectDraft) => Object.values(toProtect(d)).some((v) => v !== undefined);

function CentsInput({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="c-label">{label}</span>
      <span className="relative block">
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="—"
          className="c-input !pr-8"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--c-faint)]">¢</span>
      </span>
      <span className="mt-1 block text-[11px] leading-snug text-[var(--c-faint)]">{hint}</span>
    </label>
  );
}

export default function ProtectFields({ value, onChange, trailing = true }: { value: ProtectDraft; onChange: (v: ProtectDraft) => void; trailing?: boolean }) {
  return (
    <div className={`grid gap-3 ${trailing ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
      <CentsInput label="Take profit at" hint="Sell when it rises to this." value={value.takeProfit} onChange={(v) => onChange({ ...value, takeProfit: v })} />
      <CentsInput label="Stop loss at" hint="Sell if it falls to this." value={value.stopLoss} onChange={(v) => onChange({ ...value, stopLoss: v })} />
      {trailing && <CentsInput label="Trailing stop" hint="Sell if it drops this far from its high." value={value.trailing} onChange={(v) => onChange({ ...value, trailing: v })} />}
    </div>
  );
}
