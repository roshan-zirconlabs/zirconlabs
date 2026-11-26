import "server-only";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { PLANS, extendPeriod, type PlanId } from "./plans";

/**
 * Stablecoin payments on Polygon, matched by amount.
 *
 * An invoice asks for the plan price plus a few cents that no other open
 * invoice uses (9.37 USDC, say). Any transfer of exactly that amount to the
 * treasury pays that invoice, whichever wallet or exchange sent it, and the
 * transaction hash is the receipt. Nobody can claim someone else's payment:
 * the amount, not a pasted hash, decides which invoice it pays.
 */

/** Accepted tokens: all 6-decimal dollar stablecoins (verified on-chain 2026-11-23). */
export const ACCEPTED_TOKENS: Record<string, string> = {
  "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359": "USDC",
  "0x2791bca1f2de4661ed88a30c99a7a9449aa84174": "USDC.e",
  "0xc011a7e12a19f7b1f670d46f03b03f3342e82dfb": "pUSD",
};
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const INVOICE_TTL_MS = 24 * 60 * 60 * 1000;
/** A transfer is trusted once this many blocks deep (about 20 seconds on Polygon). */
const CONFIRMATIONS = 10;
/** Blocks per eth_getLogs call; public RPCs cap the range. */
const LOG_CHUNK = 2000;
const CURSOR_ID = "payments";
const MICRO = BigInt(1_000_000);

export class BillingNotConfiguredError extends Error {
  constructor() { super("Payments are not set up on this deployment yet."); }
}

export function treasuryAddress(): string {
  const value = process.env.PAYMENT_ADDRESS?.trim().toLowerCase() ?? "";
  if (!/^0x[0-9a-f]{40}$/.test(value)) throw new BillingNotConfiguredError();
  return value;
}

function rpcUrl(): string {
  return process.env.POLYGON_RPC_URL?.trim() || "https://polygon-bor-rpc.publicnode.com";
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.json().catch(() => null) as { result?: T; error?: { message?: string } } | null;
  if (!res.ok || !body || body.error || body.result === undefined) {
    throw new Error(`Polygon RPC ${method} failed: ${body?.error?.message ?? res.status}`);
  }
  return body.result;
}

export function formatUnits(units: string): string {
  const n = BigInt(units);
  const whole = n / MICRO;
  const frac = (n % MICRO).toString().padStart(6, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac.padEnd(2, "0")}` : `${whole}.00`;
}

/**
 * Returns the user's open invoice for this plan, or creates one with an
 * amount no other open invoice uses.
 */
export async function openInvoice(userId: string, plan: Exclude<PlanId, "FREE">) {
  treasuryAddress();
  const now = new Date();
  const existing = await prisma.payment.findFirst({
    where: { userId, plan, status: "PENDING", expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  const base = BigInt(PLANS[plan].priceUsd) * MICRO;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    // 1-99 cents on top of the price tells concurrent invoices apart.
    const cents = BigInt(crypto.randomInt(1, 100));
    const amountUnits = (base + cents * BigInt(10_000)).toString();
    const clash = await prisma.payment.findFirst({ where: { status: "PENDING", amountUnits, expiresAt: { gt: now } } });
    if (clash) continue;
    await ensureCursor();
    return prisma.payment.create({
      data: { userId, plan, amountUnits, expiresAt: new Date(now.getTime() + INVOICE_TTL_MS) },
    });
  }
  throw new Error("Too many open invoices right now. Try again in a minute.");
}

/** Starts scanning from the current block the first time an invoice exists. */
async function ensureCursor() {
  const existing = await prisma.chainCursor.findUnique({ where: { id: CURSOR_ID } });
  if (existing) return;
  const head = Number.parseInt(await rpc<string>("eth_blockNumber", []), 16);
  await prisma.chainCursor.upsert({ where: { id: CURSOR_ID }, create: { id: CURSOR_ID, block: head - CONFIRMATIONS }, update: {} });
}

type Log = { address: string; topics: string[]; data: string; transactionHash: string; blockNumber: string };

/**
 * Reads new transfers to the treasury and marks the invoices they pay. Runs
 * only while invoices are open, so an idle deployment makes no RPC calls.
 */
export async function scanPayments(): Promise<{ scanned: number; paid: number; unmatched: number }> {
  const summary = { scanned: 0, paid: 0, unmatched: 0 };
  const now = new Date();
  await prisma.payment.updateMany({
    // Invoices stay matchable for an hour past expiry, for a slow transfer.
    where: { status: "PENDING", expiresAt: { lt: new Date(now.getTime() - 60 * 60 * 1000) } },
    data: { status: "EXPIRED" },
  });
  const pending = await prisma.payment.count({ where: { status: "PENDING" } });
  if (pending === 0) return summary;

  const treasury = treasuryAddress();
  const cursor = await prisma.chainCursor.findUnique({ where: { id: CURSOR_ID } });
  if (!cursor) { await ensureCursor(); return summary; }
  const head = Number.parseInt(await rpc<string>("eth_blockNumber", []), 16) - CONFIRMATIONS;
  let from = cursor.block + 1;
  const toTopic = `0x${treasury.slice(2).padStart(64, "0")}`;

  while (from <= head) {
    const to = Math.min(from + LOG_CHUNK - 1, head);
    const logs = await rpc<Log[]>("eth_getLogs", [{
      fromBlock: `0x${from.toString(16)}`,
      toBlock: `0x${to.toString(16)}`,
      address: Object.keys(ACCEPTED_TOKENS),
      topics: [TRANSFER_TOPIC, null, toTopic],
    }]);
    for (const log of logs) {
      summary.scanned += 1;
      const token = log.address.toLowerCase();
      if (!ACCEPTED_TOKENS[token]) continue;
      const amountUnits = BigInt(log.data).toString();
      const fromAddress = `0x${log.topics[1].slice(26)}`;
      const invoice = await prisma.payment.findFirst({ where: { status: "PENDING", amountUnits }, orderBy: { createdAt: "asc" } });
      if (!invoice) { summary.unmatched += 1; continue; }
      const paid = await markPaid(invoice.id, {
        txHash: log.transactionHash.toLowerCase(), token, fromAddress, blockNumber: Number.parseInt(log.blockNumber, 16),
      });
      if (paid) summary.paid += 1;
    }
    // Advance only past blocks fully processed, so a failure re-reads them.
    await prisma.chainCursor.update({ where: { id: CURSOR_ID }, data: { block: to } });
    from = to + 1;
  }
  return summary;
}

async function markPaid(paymentId: string, receipt: { txHash: string; token: string; fromAddress: string; blockNumber: number }): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    // The same transfer can never pay twice: txHash is unique.
    if (await tx.payment.findUnique({ where: { txHash: receipt.txHash } })) return false;
    const claimed = await tx.payment.updateMany({
      where: { id: paymentId, status: "PENDING" },
      data: { status: "PAID", paidAt: new Date(), ...receipt },
    });
    if (claimed.count !== 1) return false;
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const sub = await tx.subscription.findUnique({ where: { userId: payment.userId } });
    // Renewing the same plan early stacks; switching plans starts a fresh period.
    const samePlan = sub?.plan === payment.plan;
    const currentPeriodEnd = extendPeriod(samePlan ? sub?.currentPeriodEnd ?? null : null);
    await tx.subscription.upsert({
      where: { userId: payment.userId },
      create: { userId: payment.userId, plan: payment.plan, status: "ACTIVE", currentPeriodEnd },
      update: { plan: payment.plan, status: "ACTIVE", currentPeriodEnd },
    });
    return true;
  });
}
