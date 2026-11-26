import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const headers = { "Cache-Control": "private, no-store" };
const GAMMA = "https://gamma-api.polymarket.com";

type Resolution = { closed: boolean; winner: "UP" | "DOWN" | null; conditionId: string | null };

/** Resolves each unique market slug once, however many trades share it. */
async function resolveMarkets(slugs: string[]): Promise<Map<string, Resolution>> {
  const unique = [...new Set(slugs)].slice(0, 60);
  const out = new Map<string, Resolution>();
  await Promise.all(unique.map(async slug => {
    try {
      const res = await fetch(`${GAMMA}/markets/slug/${encodeURIComponent(slug)}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!res.ok) return;
      const m = await res.json();
      const outcomes: string[] = typeof m.outcomes === "string" ? JSON.parse(m.outcomes) : m.outcomes;
      const prices: string[] = typeof m.outcomePrices === "string" ? JSON.parse(m.outcomePrices) : m.outcomePrices;
      let winner: Resolution["winner"] = null;
      if (m.closed && Array.isArray(outcomes) && Array.isArray(prices)) {
        const idx = prices.findIndex(p => Number(p) >= 0.99);
        const label = idx >= 0 ? String(outcomes[idx]).toLowerCase() : "";
        winner = /up|yes/.test(label) ? "UP" : /down|no/.test(label) ? "DOWN" : null;
      }
      out.set(slug, { closed: Boolean(m.closed), winner, conditionId: typeof m.conditionId === "string" ? m.conditionId : null });
    } catch { /* Unresolvable market: trade stays OPEN rather than guessed at. */ }
  }));
  return out;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bot = await prisma.bot.findFirst({ where: { id: (await params).botId, userId: session.user.id } });
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  const trades = await prisma.trade.findMany({ where: { botId: bot.id }, take: 100, orderBy: { createdAt: "desc" } });
  const resolutions = await resolveMarkets(trades.filter(t => t.status === "FILLED" || t.status === "CLOSED").map(t => t.marketSlug));

  let wins = 0, losses = 0, open = 0, realizedPnl = 0, totalStaked = 0, liveCount = 0, paperCount = 0;
  const tradeRows = trades.map(t => {
    if (t.paper) paperCount++; else liveCount++;
    const isFill = t.status === "FILLED" || t.status === "CLOSED";
    totalStaked += isFill ? t.amount : 0;
    const res = resolutions.get(t.marketSlug);
    let outcome: "OPEN" | "WON" | "LOST" | "N/A" = "N/A";
    let pnlUsd: number | null = null;
    let redeemable = false;
    if (isFill) {
      if (!res || !res.closed) { outcome = "OPEN"; open++; }
      else if (res.winner && t.shares != null) {
        const won = res.winner === t.direction;
        outcome = won ? "WON" : "LOST";
        pnlUsd = won ? Number((t.shares - t.amount).toFixed(4)) : Number((-t.amount).toFixed(4));
        realizedPnl += pnlUsd;
        if (won) { wins++; redeemable = !t.paper; } else losses++;
      } else { outcome = "OPEN"; open++; }
    }
    return {
      id: t.id, marketSlug: t.marketSlug, direction: t.direction, side: t.side,
      amountUsd: t.amount, price: t.price, shares: t.shares, status: t.status,
      paper: t.paper, orderId: t.orderId, executedAt: (t.executedAt ?? t.createdAt).toISOString(),
      outcome, pnlUsd, redeemable, conditionId: res?.conditionId ?? null,
    };
  });

  const resolvedCount = wins + losses;
  const stats = {
    totalTrades: trades.length, filled: trades.filter(t => t.status === "FILLED" || t.status === "CLOSED").length,
    wins, losses, open, resolvedCount,
    winRate: resolvedCount > 0 ? Number(((wins / resolvedCount) * 100).toFixed(1)) : null,
    totalStakedUsd: Number(totalStaked.toFixed(2)), realizedPnlUsd: Number(realizedPnl.toFixed(2)),
    liveCount, paperCount,
  };

  // The run log: every evaluation, classified — trades, sat-outs and failures
  // alike, so "what failed and why" is answerable from this page.
  const local = await prisma.botRun.findMany({ where: { botId: bot.id }, orderBy: { startedAt: "desc" }, take: 40 });
  const runs = local.map(r => ({
    kind: r.outcome === "TRADED" ? "TRADED" : r.outcome === "FAILED" ? "FAILED" : "SAT_OUT",
    reason: r.reason,
    marketSlug: r.marketSlug,
    direction: r.direction,
    amount: r.amount,
    price: r.price,
    startedAt: r.startedAt.toISOString(),
    durationMs: r.durationMs,
  }));
  const runsWarning: string | undefined = undefined;

  return NextResponse.json({ stats, trades: tradeRows, runs, runsWarning }, { headers });
}
