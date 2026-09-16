import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { keeperhubForUser } from "@/lib/keeperhub-connection";

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

/**
 * Classifies one KeeperHub execution record without a raw status vocabulary
 * leaking through: a workflow can succeed and still not trade (the Condition
 * gate said no), which is not the same thing as failing.
 */
function classifyRun(e: Record<string, unknown>): { kind: "TRADED" | "SAT_OUT" | "FAILED"; reason: string | null; marketSlug: string | null; direction: string | null; amount: number | null; price: number | null } {
  const error = typeof e.error === "string" ? e.error : null;
  const lastNode = typeof e.lastSuccessfulNodeName === "string" ? e.lastSuccessfulNodeName : "";
  const output = e.output as { data?: Record<string, unknown> } | null | undefined;
  const data = output?.data;

  if (error) {
    return { kind: "FAILED", reason: error.slice(0, 240), marketSlug: null, direction: null, amount: null, price: null };
  }
  if (lastNode === "Place Polymarket order" && data && typeof data === "object") {
    return {
      kind: "TRADED",
      reason: typeof data.reason === "string" ? data.reason : null,
      marketSlug: typeof data.marketSlug === "string" ? data.marketSlug : null,
      direction: typeof data.direction === "string" ? data.direction : null,
      amount: typeof data.amount === "number" ? data.amount : null,
      price: typeof data.price === "number" ? data.price : null,
    };
  }
  return { kind: "SAT_OUT", reason: "The rule did not produce a tradable signal this run.", marketSlug: null, direction: null, amount: null, price: null };
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
        if (won) { wins++; realizedPnl += pnlUsd; redeemable = !t.paper; } else losses++;
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

  // The run log: every KeeperHub execution, classified — trades, sat-outs and
  // failures alike, so "what failed and why" is answerable from this page.
  let runs: Array<ReturnType<typeof classifyRun> & { startedAt: string | null; durationMs: number | null }> = [];
  let runsWarning: string | undefined;
  if (bot.keeperhubWorkflowId && !bot.keeperhubWorkflowId.startsWith("local_")) {
    try {
      const { client } = await keeperhubForUser(session.user.id);
      // getExecutions()'s declared type is a normalized view, but the objects
      // it returns still carry KeeperHub's raw fields at runtime — read those
      // directly rather than adding a second client method for the same call.
      const raw = (await client.getExecutions(bot.keeperhubWorkflowId)) as unknown as Record<string, unknown>[];
      runs = raw.slice(0, 40).map(e => ({
        ...classifyRun(e),
        startedAt: typeof e.startedAt === "string" ? e.startedAt : null,
        durationMs: typeof e.duration === "string" ? Number(e.duration) : (typeof e.duration === "number" ? e.duration : null),
      }));
    } catch { runsWarning = "Run history is unavailable right now."; }
  }

  return NextResponse.json({ stats, trades: tradeRows, runs, runsWarning }, { headers });
}
