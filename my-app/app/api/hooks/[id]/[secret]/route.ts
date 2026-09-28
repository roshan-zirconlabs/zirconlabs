import crypto from "crypto";
import { after, NextResponse } from "next/server";
import type { Automation, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { hashSecret } from "@/lib/automations/service";
import { readState, webhookConfig } from "@/lib/automations/config";
import { alertAction } from "@/lib/automations/evaluate";
import { getMarket } from "@/lib/polymarket/markets";
import { getOrderBook } from "@/lib/polymarket/prices";
import { placeOrder } from "@/lib/trading/execute";
import { heldShares } from "@/lib/trading/portfolio";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * TradingView (or any alert source) → Polymarket.
 *
 * The URL carries a per-automation secret; only its hash is stored. The alert
 * can say buy or sell, nothing else — size and price limits come from the
 * automation the user saved, so a leaked URL can't be used to trade bigger.
 */

const reply = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

function sameHash(a: string, b: string) {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

async function readAction(req: Request) {
  const text = (await req.text().catch(() => "")).slice(0, 2000).trim();
  if (!text) return null;
  try {
    const body = JSON.parse(text) as Record<string, unknown>;
    return alertAction(body.action ?? body.side ?? body.signal ?? body.order);
  } catch {
    return alertAction(text.split(/\s+/)[0]);
  }
}

async function execute(a: Automation, action: "buy" | "sell") {
  const config = webhookConfig.parse(a.config);
  try {
    const market = await getMarket(a.marketSlug);
    const outcome = market.outcomes.find((o) => o.tokenId === a.tokenId);
    if (!outcome || !market.tradable) {
      await prisma.automation.update({ where: { id: a.id }, data: { status: "DONE", lastError: "Market closed." } });
      await logActivity({ userId: a.userId, automationId: a.id, mode: a.mode, level: "WARNING", title: `Alert ignored: the market has closed — ${a.question}` });
      return;
    }
    const book = await getOrderBook(outcome.tokenId);
    const slip = config.slippageCents / 100;
    const key = `hook:${a.id}:${crypto.randomUUID()}`;
    if (action === "buy") {
      const ask = book.asks[0]?.price;
      if (ask === undefined || ask > config.maxPrice) {
        await logActivity({ userId: a.userId, automationId: a.id, mode: a.mode, level: "WARNING", title: `Buy alert skipped: price is above your ${Math.round(config.maxPrice * 100)}¢ limit — ${a.question}` });
        return;
      }
      await placeOrder({ userId: a.userId, mode: a.mode, side: "BUY", market, outcome, size: config.amountUsd, limitPrice: Math.min(config.maxPrice, ask + slip), reason: "TradingView buy alert.", idempotencyKey: key, automationId: a.id });
    } else {
      const held = await heldShares(a.userId, a.mode, a.tokenId);
      if (held <= 1e-6) {
        await logActivity({ userId: a.userId, automationId: a.id, mode: a.mode, title: `Sell alert ignored: nothing held — ${a.question}` });
        return;
      }
      const bid = book.bids[0]?.price;
      if (bid === undefined) {
        await logActivity({ userId: a.userId, automationId: a.id, mode: a.mode, level: "WARNING", title: `Sell alert couldn't run: no buyers right now — ${a.question}` });
        return;
      }
      await placeOrder({ userId: a.userId, mode: a.mode, side: "SELL", market, outcome, size: held, limitPrice: Math.max(0.01, bid - slip), reason: "TradingView sell alert.", idempotencyKey: key, automationId: a.id });
    }
  } catch (error) {
    await prisma.automation.update({ where: { id: a.id }, data: { lastError: error instanceof Error ? error.message.slice(0, 300) : "Alert failed." } }).catch(() => {});
    await logActivity({ userId: a.userId, automationId: a.id, mode: a.mode, level: "ERROR", title: `Alert failed — ${a.question}`, detail: error instanceof Error ? error.message : undefined });
  } finally {
    await prisma.automation.update({ where: { id: a.id }, data: { lockedUntil: null } }).catch(() => {});
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string; secret: string }> }) {
  const { id, secret } = await params;
  if (!/^[a-z0-9]{10,40}$/i.test(id) || !/^[A-Za-z0-9_-]{20,64}$/.test(secret)) return reply(404, { error: "Unknown webhook." });
  const automation = await prisma.automation.findUnique({ where: { id } });
  if (!automation || automation.kind !== "WEBHOOK" || !automation.webhookSecretHash || !sameHash(hashSecret(secret), automation.webhookSecretHash)) {
    return reply(404, { error: "Unknown webhook." });
  }
  if (automation.status !== "ACTIVE") return reply(409, { error: "This automation is paused or finished." });

  const action = await readAction(req);
  if (!action) return reply(400, { error: 'Send "buy" or "sell" — e.g. {"action": "{{strategy.order.action}}"}.' });

  const config = webhookConfig.parse(automation.config);
  const now = new Date();
  const state = readState(automation.state);
  if (state.lastSignalAt && now.getTime() - state.lastSignalAt < config.cooldownSeconds * 1000) {
    return reply(429, { error: `Ignored: another alert arrived less than ${config.cooldownSeconds}s ago.` });
  }
  // Lease so two simultaneous alerts can't both trade.
  const { count } = await prisma.automation.updateMany({
    where: { id, status: "ACTIVE", OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
    data: { lockedUntil: new Date(now.getTime() + 60_000), lastCheckedAt: now, state: { ...state, lastSignalAt: now.getTime() } as Prisma.InputJsonValue },
  });
  if (count !== 1) return reply(429, { error: "Ignored: the previous alert is still being processed." });

  after(() => execute(automation, action));
  return reply(202, { ok: true, accepted: action });
}
