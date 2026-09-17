import "server-only";

// A strategy's track record, recomputable by anyone from two public sources:
// KeeperHub's execution records (the trades it took) and Polymarket's on-chain
// resolution (whether each was right). Nothing here reads Zircon's own database,
// so the numbers are verifiable, not self-reported.

const GAMMA = "https://gamma-api.polymarket.com";

type Winner = "UP" | "DOWN" | null;
type MarketResolution = { closed: boolean; winner: Winner; conditionId: string | null };

export type VerifiedTrade = {
  executionId: string | null;
  txHash: string | null;
  marketSlug: string;
  direction: "UP" | "DOWN";
  amountUsd: number;
  shares: number;
  conditionId: string | null;
  outcome: "WON" | "LOST" | "OPEN";
  pnlUsd: number | null;
};

export type TrackRecord = {
  trades: number;
  resolved: number;
  wins: number;
  losses: number;
  open: number;
  winRate: number | null;
  realizedPnlUsd: number;
  stakedUsd: number;
  firstTradeAt: string | null;
  lastTradeAt: string | null;
  proof: VerifiedTrade[];
};

async function resolveMarkets(slugs: string[]): Promise<Map<string, MarketResolution>> {
  const out = new Map<string, MarketResolution>();
  await Promise.all(
    [...new Set(slugs)].slice(0, 80).map(async (slug) => {
      try {
        const res = await fetch(`${GAMMA}/markets/slug/${encodeURIComponent(slug)}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return;
        const m = await res.json();
        const outcomes = typeof m.outcomes === "string" ? JSON.parse(m.outcomes) : m.outcomes;
        const prices = typeof m.outcomePrices === "string" ? JSON.parse(m.outcomePrices) : m.outcomePrices;
        let winner: Winner = null;
        if (m.closed && Array.isArray(outcomes) && Array.isArray(prices)) {
          const idx = prices.findIndex((p: string) => Number(p) >= 0.99);
          const label = idx >= 0 ? String(outcomes[idx]).toLowerCase() : "";
          winner = /up|yes/.test(label) ? "UP" : /down|no/.test(label) ? "DOWN" : null;
        }
        out.set(slug, {
          closed: Boolean(m.closed),
          winner,
          conditionId: typeof m.conditionId === "string" ? m.conditionId : null,
        });
      } catch {
        // Unresolved market: its trade stays OPEN rather than guessed at.
      }
    }),
  );
  return out;
}

type Traded = Pick<VerifiedTrade, "executionId" | "txHash" | "marketSlug" | "direction" | "amountUsd" | "shares"> & {
  at: string | null;
};

function tradedFromExecution(e: Record<string, unknown>): Traded | null {
  if ((typeof e.error === "string" && e.error) || e.lastSuccessfulNodeName !== "Place Polymarket order") return null;
  const data = (e.output as { data?: Record<string, unknown> } | undefined)?.data;
  if (!data) return null;
  const { marketSlug, direction, amount, shares } = data;
  if (typeof marketSlug !== "string" || (direction !== "UP" && direction !== "DOWN") || typeof amount !== "number" || typeof shares !== "number") {
    return null;
  }
  const hashes = e.transactionHashes as Array<{ hash?: string }> | undefined;
  return {
    executionId: typeof e.executionId === "string" ? e.executionId : typeof e.id === "string" ? e.id : null,
    txHash: hashes?.[0]?.hash ?? null,
    marketSlug,
    direction,
    amountUsd: amount,
    shares,
    at: typeof e.startedAt === "string" ? e.startedAt : null,
  };
}

export async function computeTrackRecord(executions: Record<string, unknown>[]): Promise<TrackRecord> {
  const traded = executions.map(tradedFromExecution).filter((t): t is Traded => t !== null);
  const resolutions = await resolveMarkets(traded.map((t) => t.marketSlug));

  let wins = 0;
  let losses = 0;
  let open = 0;
  let realizedPnlUsd = 0;
  let stakedUsd = 0;

  const proof: VerifiedTrade[] = traded.map((t) => {
    stakedUsd += t.amountUsd;
    const r = resolutions.get(t.marketSlug);
    let outcome: VerifiedTrade["outcome"] = "OPEN";
    let pnlUsd: number | null = null;
    if (r?.closed && r.winner) {
      const won = r.winner === t.direction;
      outcome = won ? "WON" : "LOST";
      pnlUsd = Number((won ? t.shares - t.amountUsd : -t.amountUsd).toFixed(4));
      if (won) {
        wins++;
        realizedPnlUsd += pnlUsd;
      } else {
        losses++;
      }
    } else {
      open++;
    }
    return {
      executionId: t.executionId,
      txHash: t.txHash,
      marketSlug: t.marketSlug,
      direction: t.direction,
      amountUsd: t.amountUsd,
      shares: t.shares,
      conditionId: r?.conditionId ?? null,
      outcome,
      pnlUsd,
    };
  });

  const times = traded.map((t) => t.at).filter((x): x is string => Boolean(x)).sort();
  const resolved = wins + losses;
  return {
    trades: traded.length,
    resolved,
    wins,
    losses,
    open,
    winRate: resolved > 0 ? Number(((wins / resolved) * 100).toFixed(1)) : null,
    realizedPnlUsd: Number(realizedPnlUsd.toFixed(2)),
    stakedUsd: Number(stakedUsd.toFixed(2)),
    firstTradeAt: times[0] ?? null,
    lastTradeAt: times.at(-1) ?? null,
    proof,
  };
}
