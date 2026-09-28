import "server-only";
import type { Automation, Prisma } from "@prisma/client";
import { redeemPositions } from "@polymarket/client/actions";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { num } from "@/lib/money";
import { getMarket, type Market } from "@/lib/polymarket/markets";
import { getLivePositions, getMidpoints } from "@/lib/polymarket/prices";
import { createManagedPolymarketClient } from "@/lib/polymarket/live-client";
import { liveTradingAvailable } from "@/lib/polymarket/managed-account";
import { tradingDepositWallet } from "@/lib/polymarket/account";
import { entryConfig, exitConfig, readState, type AutomationState } from "@/lib/automations/config";
import { evaluateEntry, evaluateExit, type Decision } from "@/lib/automations/evaluate";
import { createAutomation, describeAutomation } from "@/lib/automations/service";
import { placeOrder, OrderError } from "@/lib/trading/execute";
import { heldShares } from "@/lib/trading/portfolio";
import { sendTelegram, telegramConfigured } from "@/lib/telegram";

/**
 * One pass of the automation engine. Safe to run from several places at once
 * (a worker loop, a cron route): every automation is leased before it can
 * act, and every order is idempotent.
 */

export type TickReport = {
  checked: number;
  fired: number;
  errors: number;
  settled: number;
  claimed: number;
  reconciled: number;
  alerts: number;
  ms: number;
};

const LEASE_MS = 2 * 60_000;
const MAX_EXIT_ATTEMPTS = 20;
const CLAIM_EVERY_MS = 10 * 60_000;

async function lease(id: string, now: Date) {
  const { count } = await prisma.automation.updateMany({
    where: { id, status: "ACTIVE", OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
    data: { lockedUntil: new Date(now.getTime() + LEASE_MS) },
  });
  return count === 1;
}

const marketCache = new Map<string, { at: number; market: Market }>();
async function market(slug: string) {
  const hit = marketCache.get(slug);
  if (hit && Date.now() - hit.at < 60_000) return hit.market;
  const m = await getMarket(slug);
  marketCache.set(slug, { at: Date.now(), market: m });
  return m;
}

async function finishAutomation(a: Automation, data: Prisma.AutomationUpdateInput, activity?: { title: string; detail?: string; level: "SUCCESS" | "WARNING" | "ERROR" }) {
  await prisma.automation.update({ where: { id: a.id }, data: { ...data, lockedUntil: null } });
  if (activity) await logActivity({ userId: a.userId, automationId: a.id, mode: a.mode, ...activity });
}

async function fire(a: Automation, decision: Decision & object, state: AutomationState, now: Date) {
  const m = await market(a.marketSlug);
  const outcome = m.outcomes.find((o) => o.tokenId === a.tokenId);
  if (!outcome || !m.tradable) {
    await finishAutomation(a, { status: "DONE", lastError: "The market closed before this could run." },
      { level: "WARNING", title: `Automation stopped: the market closed — ${a.question}` });
    return;
  }

  if (a.kind === "ENTRY") {
    const config = entryConfig.parse(a.config);
    const attempts = state.attempts ?? 0;
    const { order } = await placeOrder({
      userId: a.userId, mode: a.mode, side: "BUY", market: m, outcome, size: config.amountUsd,
      limitPrice: decision.limitPrice, reason: decision.reason, idempotencyKey: `auto:${a.id}:entry:${attempts}`, automationId: a.id,
    });
    const bought = order.status === "FILLED" || order.status === "PARTIAL" || order.status === "QUEUED";
    // Nothing within the limit yet: try again next tick, but not forever.
    const retry = order.status === "UNFILLED" && attempts + 1 < MAX_EXIT_ATTEMPTS;
    await finishAutomation(a, {
      status: bought ? "DONE" : retry ? "ACTIVE" : "FAILED", firedAt: bought ? now : undefined,
      state: { ...state, attempts: attempts + 1 } as Prisma.InputJsonValue,
      lastError: bought ? null : retry ? "Nothing on offer within the price limit yet — retrying." : order.error,
    }, bought || retry ? undefined : { level: "ERROR", title: `Entry stopped — ${a.question}`, detail: order.error ?? "The buy couldn't be completed." });
    if (bought && config.thenExit && Object.values(config.thenExit).some((v) => v !== undefined)) {
      await createAutomation({ userId: a.userId, mode: a.mode, kind: "EXIT", marketSlug: a.marketSlug, outcome: a.outcome, config: config.thenExit })
        .catch((e) => logActivity({ userId: a.userId, automationId: a.id, mode: a.mode, level: "WARNING", title: "Bought, but the protection couldn't be attached", detail: String(e?.message ?? e) }));
    }
    return;
  }

  // EXIT: sell a share of whatever is held right now.
  const config = exitConfig.parse(a.config);
  const held = await heldShares(a.userId, a.mode, a.tokenId);
  if (held <= 1e-6) {
    await finishAutomation(a, { status: "DONE", lastError: null }, { level: "SUCCESS", title: `Automation finished: position already closed — ${a.question}` });
    return;
  }
  const attempts = state.attempts ?? 0;
  const shares = config.sellPercent >= 100 ? held : held * (config.sellPercent / 100);
  const { order } = await placeOrder({
    userId: a.userId, mode: a.mode, side: "SELL", market: m, outcome, size: shares,
    limitPrice: decision.limitPrice, reason: decision.reason, idempotencyKey: `auto:${a.id}:exit:${attempts}`, automationId: a.id,
  });
  const nextState = { ...state, attempts: attempts + 1 } as Prisma.InputJsonValue;
  if (order.status === "FILLED" || order.status === "QUEUED") {
    await finishAutomation(a, { status: "DONE", firedAt: now, state: nextState, lastError: null });
  } else if ((order.status === "PARTIAL" || order.status === "UNFILLED") && attempts + 1 < MAX_EXIT_ATTEMPTS) {
    // Keep trying next tick for what's left.
    await finishAutomation(a, { state: nextState, firedAt: now, lastError: order.status === "UNFILLED" ? "No buyers within the price limit yet — retrying." : "Partly sold — selling the rest next." });
  } else {
    await finishAutomation(a, { status: "FAILED", state: nextState, lastError: order.error ?? "The exit couldn't be completed." },
      { level: "ERROR", title: `Exit failed — ${a.question}`, detail: `${order.error ?? ""} Check the position and sell it manually if needed.` });
  }
}

async function runAutomations(now: Date, deadline: number, report: TickReport) {
  const automations = await prisma.automation.findMany({
    where: { status: "ACTIVE", kind: { in: ["EXIT", "ENTRY"] }, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
    orderBy: { lastCheckedAt: { sort: "asc", nulls: "first" } },
    take: 300,
    include: { user: { select: { tradingAccount: { select: { paused: true } } } } },
  });
  if (!automations.length) return;
  const mids = await getMidpoints(automations.map((a) => a.tokenId));

  // Holdings for exit rules, fetched once per user and book this tick.
  const holdings = new Map<string, Promise<number>>();
  const heldNow = (a: Automation) => {
    const key = `${a.userId}:${a.mode}:${a.tokenId}`;
    if (!holdings.has(key)) holdings.set(key, heldShares(a.userId, a.mode, a.tokenId).catch(() => -1));
    return holdings.get(key)!;
  };

  for (const a of automations) {
    if (Date.now() > deadline) break;
    report.checked++;
    // The kill switch holds live automations; practice keeps running.
    if (a.mode === "LIVE" && (a.user.tradingAccount?.paused || !liveTradingAvailable())) continue;
    const mid = mids.get(a.tokenId);
    if (mid === undefined) {
      // No price usually means the market has closed; confirm before stopping.
      const m = await market(a.marketSlug).catch(() => null);
      if (m && !m.tradable) {
        await finishAutomation(a, { status: "DONE", lastCheckedAt: now, lastError: "Market closed." },
          { level: "WARNING", title: `Automation stopped: the market closed — ${a.question}`, detail: m.resolved ? `Resolved: ${m.winner}. Winnings are claimed automatically.` : undefined });
      }
      continue;
    }
    try {
      if (a.kind === "EXIT") {
        // Protection ends with its position (sold by another rule or by hand).
        // Live position data can lag a fresh buy, so a new live rule is left alone.
        const settledIn = a.mode === "LIVE" ? 5 * 60_000 : 0;
        const held = await heldNow(a);
        if (held === 0 && now.getTime() - a.createdAt.getTime() > settledIn) {
          await finishAutomation(a, { status: "DONE", lastCheckedAt: now, lastPrice: mid, lastError: null },
            { level: "SUCCESS", title: `Protection ended: position closed — ${a.question}` });
          continue;
        }
      }
      const state = readState(a.state);
      let decision: Decision;
      let nextState: AutomationState = state;
      if (a.kind === "EXIT") {
        const result = evaluateExit(exitConfig.parse(a.config), state, mid, now.getTime(), a.endDate);
        decision = result.decision;
        nextState = { ...state, ...result.state };
      } else {
        decision = evaluateEntry(entryConfig.parse(a.config), mid);
      }
      await prisma.automation.update({ where: { id: a.id }, data: { lastPrice: mid, lastCheckedAt: now, state: nextState as Prisma.InputJsonValue } });
      if (!decision || !(await lease(a.id, now))) continue;
      report.fired++;
      await fire({ ...a, state: nextState as Prisma.JsonValue }, decision, nextState, now);
    } catch (error) {
      report.errors++;
      const message = error instanceof OrderError ? error.message : error instanceof Error ? error.message.slice(0, 300) : "Unexpected error";
      await prisma.automation.update({ where: { id: a.id }, data: { lastError: message, lastCheckedAt: now, lockedUntil: null } }).catch(() => {});
      // A rule the user must fix (limit reached, live off) pauses instead of retrying every tick.
      if (error instanceof OrderError && error.status === 409) {
        await finishAutomation(a, { status: "PAUSED" }, { level: "ERROR", title: `Automation paused — ${describeAutomation(a)}`, detail: message });
      }
    }
  }
}

/** Practice positions on resolved markets pay out like the real thing: $1 per winning share. */
async function settlePaper(now: Date, deadline: number, report: TickReport) {
  // Markets can resolve before their end date, so every open practice position
  // is re-checked every 10 minutes (oldest first).
  const open = await prisma.paperPosition.findMany({
    where: { settledAt: null, shares: { gt: 0.000001 }, updatedAt: { lt: new Date(now.getTime() - 10 * 60_000) } },
    take: 100, orderBy: { updatedAt: "asc" },
  });
  const bySlug = new Map<string, typeof open>();
  for (const p of open) bySlug.set(p.marketSlug, [...(bySlug.get(p.marketSlug) ?? []), p]);
  for (const [slug, positions] of bySlug) {
    if (Date.now() > deadline) break;
    const m = await getMarket(slug).catch(() => null);
    if (!m?.resolved) {
      // Touch so the next pass checks other positions first.
      await prisma.paperPosition.updateMany({ where: { id: { in: positions.map((p) => p.id) }, settledAt: null }, data: { settledAt: null } });
      continue;
    }
    for (const p of positions) {
      const payout = m.winner?.toLowerCase() === p.outcome.toLowerCase() ? num(p.shares) : 0;
      const settled = await prisma.$transaction(async (tx) => {
        const { count } = await tx.paperPosition.updateMany({ where: { id: p.id, settledAt: null }, data: { settledAt: now, shares: 0, costUsd: 0 } });
        if (count !== 1) return false;
        if (payout > 0) await tx.user.update({ where: { id: p.userId }, data: { paperCash: { increment: payout } } });
        return true;
      });
      if (!settled) continue;
      report.settled++;
      await logActivity({
        userId: p.userId, mode: "PAPER", level: payout > 0 ? "SUCCESS" : "INFO",
        title: `${payout > 0 ? "Won" : "Lost"}: ${p.question} resolved ${m.winner} (practice)`,
        detail: payout > 0 ? `$${payout.toFixed(2)} added to your practice cash.` : `Your ${p.outcome} shares expired worthless.`,
      });
    }
  }
}

/** Claims live winnings so they become spendable cash again without a click. */
async function claimLive(now: Date, deadline: number, report: TickReport) {
  if (!liveTradingAvailable()) return;
  const accounts = await prisma.tradingAccount.findMany({
    where: { liveEnabled: true, depositWalletAddress: { not: null }, OR: [{ lastClaimCheckAt: null }, { lastClaimCheckAt: { lt: new Date(now.getTime() - CLAIM_EVERY_MS) } }] },
    take: 20,
  });
  for (const account of accounts) {
    if (Date.now() > deadline) break;
    await prisma.tradingAccount.update({ where: { id: account.id }, data: { lastClaimCheckAt: now } });
    try {
      const wallet = await tradingDepositWallet(account);
      const claimable = (await getLivePositions(wallet)).filter((p) => p.claimable);
      const conditions = [...new Set(claimable.map((p) => p.conditionId))].slice(0, 5);
      if (!conditions.length) continue;
      const client = await createManagedPolymarketClient(account.providerWalletId);
      for (const conditionId of conditions) {
        const value = claimable.filter((p) => p.conditionId === conditionId).reduce((s, p) => s + p.valueUsd, 0);
        const handle = await redeemPositions(client, { conditionId });
        report.claimed++;
        await logActivity({
          userId: account.userId, mode: "LIVE", level: "SUCCESS",
          title: `Claimed $${value.toFixed(2)} in winnings — ${claimable.find((p) => p.conditionId === conditionId)?.question ?? "resolved market"}`,
          detail: handle.transactionHash ? `https://polygonscan.com/tx/${handle.transactionHash}` : "Submitted to Polygon.",
        });
      }
    } catch (error) {
      await logActivity({ userId: account.userId, mode: "LIVE", level: "WARNING", title: "Couldn't claim winnings automatically — will retry", detail: error instanceof Error ? error.message.slice(0, 300) : undefined });
    }
  }
}

/** Queued live orders: ask Polymarket what actually matched. */
async function reconcileQueued(now: Date, deadline: number, report: TickReport) {
  const queued = await prisma.order.findMany({ where: { status: "QUEUED", mode: "LIVE", exchangeOrderId: { not: null } }, take: 20 });
  for (const order of queued) {
    if (Date.now() > deadline) break;
    try {
      const account = await prisma.tradingAccount.findUniqueOrThrow({ where: { userId: order.userId } });
      const client = await createManagedPolymarketClient(account.providerWalletId);
      const remote = await client.fetchOrder({ orderId: order.exchangeOrderId! });
      const matched = Number(remote.sizeMatched);
      const open = /live|delayed|unmatched/i.test(remote.status) && now.getTime() - order.createdAt.getTime() < 10 * 60_000;
      if (open) continue;
      const price = Number(remote.price);
      await prisma.order.update({
        where: { id: order.id },
        data: matched > 0
          ? { status: matched >= Number(remote.originalSize) * 0.99 ? "FILLED" : "PARTIAL", filledShares: matched, filledUsd: matched * price }
          : { status: "UNFILLED", error: "Polymarket's queue didn't match this order." },
      });
      report.reconciled++;
    } catch { /* Try again next tick. */ }
  }
}

async function sendAlerts(deadline: number, report: TickReport) {
  if (!telegramConfigured()) return;
  const pending = await prisma.activity.findMany({
    where: { notifiedAt: null, level: { in: ["SUCCESS", "WARNING", "ERROR"] }, user: { telegramChatId: { not: null } } },
    include: { user: { select: { telegramChatId: true } } },
    orderBy: { createdAt: "asc" }, take: 30,
  });
  for (const a of pending) {
    if (Date.now() > deadline) break;
    const icon = a.level === "ERROR" ? "⚠️" : a.level === "WARNING" ? "🟡" : "✅";
    try {
      await sendTelegram(a.user.telegramChatId!, `${icon} ${a.title}${a.detail ? `\n${a.detail}` : ""}`);
      report.alerts++;
    } catch { /* Marked anyway so a bad chat never blocks the queue. */ }
    await prisma.activity.update({ where: { id: a.id }, data: { notifiedAt: new Date() } });
  }
}

export async function runTick(budgetMs = 45_000): Promise<TickReport> {
  const started = Date.now();
  const deadline = started + budgetMs;
  const now = new Date();
  const report: TickReport = { checked: 0, fired: 0, errors: 0, settled: 0, claimed: 0, reconciled: 0, alerts: 0, ms: 0 };
  // Each stage is isolated: one failing API never stops the others.
  for (const stage of [runAutomations, settlePaper, claimLive, reconcileQueued]) {
    try { await stage(now, deadline, report); } catch (error) { report.errors++; console.error(`[tick] ${stage.name} failed:`, error); }
  }
  try { await sendAlerts(deadline, report); } catch (error) { report.errors++; console.error("[tick] sendAlerts failed:", error); }
  report.ms = Date.now() - started;
  return report;
}
