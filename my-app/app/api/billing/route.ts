import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PLANS, effectivePlan } from "@/lib/billing/plans";
import { ACCEPTED_TOKENS, BillingNotConfiguredError, formatUnits, openInvoice, scanPayments, treasuryAddress } from "@/lib/billing/chain";

const headers = { "Cache-Control": "private, no-store" };

function treasuryOrNull(): string | null {
  try { return treasuryAddress(); } catch { return null; }
}

async function view(userId: string) {
  const [sub, payments, running] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.payment.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.bot.count({ where: { userId, status: "ACTIVE" } }),
  ]);
  const plan = effectivePlan(sub);
  return {
    plan,
    activeBotLimit: PLANS[plan].activeBots,
    runningBots: running,
    currentPeriodEnd: plan === "FREE" ? null : sub?.currentPeriodEnd?.toISOString() ?? null,
    paymentAddress: treasuryOrNull(),
    acceptedTokens: Object.entries(ACCEPTED_TOKENS).map(([address, symbol]) => ({ address, symbol })),
    payments: payments.map(p => ({
      id: p.id, plan: p.plan, amount: formatUnits(p.amountUnits), status: p.status,
      expiresAt: p.expiresAt.toISOString(), paidAt: p.paidAt?.toISOString() ?? null,
      txHash: p.txHash, token: p.token ? ACCEPTED_TOKENS[p.token] ?? p.token : null,
    })),
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await view(session.user.id), { headers });
}

const action = z.union([
  z.object({ action: z.literal("invoice"), plan: z.enum(["PRO", "ENTERPRISE"]) }),
  z.object({ action: z.literal("check") }),
]);

/** Opens an invoice for a plan, or checks the chain for a payment now. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = action.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a plan." }, { status: 400, headers });
  try {
    if (parsed.data.action === "invoice") await openInvoice(session.user.id, parsed.data.plan);
    else await scanPayments();
  } catch (error) {
    if (error instanceof BillingNotConfiguredError) return NextResponse.json({ error: error.message }, { status: 503, headers });
    return NextResponse.json({ error: "Could not reach Polygon right now. Your payment is safe; it is picked up automatically within a minute." }, { status: 502, headers });
  }
  return NextResponse.json(await view(session.user.id), { headers });
}
