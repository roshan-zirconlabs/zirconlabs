import type { TrackRecord, VerifiedTrade } from "@/lib/track-record";

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  const color = tone === "up" ? "text-[var(--c-up)]" : tone === "down" ? "text-[var(--c-down)]" : "text-white";
  return (
    <div className="c-panel p-4">
      <p className="c-mono text-[11px] uppercase tracking-wider text-[var(--c-faint)]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function outcome({ outcome }: VerifiedTrade) {
  if (outcome === "WON") return <span className="text-[var(--c-up)]">Won</span>;
  if (outcome === "LOST") return <span className="text-[var(--c-down)]">Lost</span>;
  return <span className="text-[var(--c-faint)]">Open</span>;
}

const money = (n: number) => `${n >= 0 ? "+" : ""}$${n.toFixed(2)}`;

export default function TrackRecordView({ record, showProof }: { record: TrackRecord; showProof?: boolean }) {
  const pnl = record.realizedPnlUsd;
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Win rate" value={record.winRate != null ? `${record.winRate}%` : "—"} />
        <Stat label="Realized P&L" value={money(pnl)} tone={pnl > 0 ? "up" : pnl < 0 ? "down" : undefined} />
        <Stat label="Resolved" value={`${record.wins}W · ${record.losses}L`} />
        <Stat label="Trades" value={`${record.trades}`} />
      </div>
      {showProof && record.proof.length > 0 && (
        <div className="c-panel mt-4 overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="c-mono text-[11px] uppercase tracking-wider text-[var(--c-faint)]">
              <tr>
                <th className="p-3 font-normal">Market</th>
                <th className="p-3 font-normal">Call</th>
                <th className="p-3 font-normal">Outcome</th>
                <th className="p-3 font-normal">P&amp;L</th>
                <th className="p-3 font-normal">Proof</th>
              </tr>
            </thead>
            <tbody>
              {record.proof.map((t, i) => (
                <tr key={t.executionId ?? i} className="border-t border-white/5">
                  <td className="c-mono max-w-[220px] truncate p-3 text-xs text-[var(--c-dim)]">{t.marketSlug}</td>
                  <td className="p-3 text-white">{t.direction}</td>
                  <td className="p-3">{outcome(t)}</td>
                  <td className={`p-3 ${t.pnlUsd == null ? "text-[var(--c-faint)]" : t.pnlUsd >= 0 ? "text-[var(--c-up)]" : "text-[var(--c-down)]"}`}>
                    {t.pnlUsd != null ? money(t.pnlUsd) : "—"}
                  </td>
                  <td className="p-3">
                    <a className="text-[var(--c-pink)] hover:underline" href={`https://polymarket.com/market/${t.marketSlug}`} target="_blank" rel="noreferrer">
                      verify ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
