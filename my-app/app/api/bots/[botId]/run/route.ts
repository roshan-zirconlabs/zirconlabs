import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { liveExecutionConfigured } from "@/lib/polymarket/managed-account";
import { strategySpec } from "@/lib/workflow/strategy";
import { runRuleBot } from "@/lib/runner/run";

/**
 * "Run now": evaluates a scheduled bot immediately, through the same
 * per-window guard as its scheduled runs, so it can never double a trade.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bot = await prisma.bot.findFirst({ where: { id: (await params).botId, userId: session.user.id } });
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  if (body.confirmLive !== true) return NextResponse.json({ error: "Explicit run confirmation is required. A real-money bot spends real funds." }, { status: 400 });
  if (bot.status !== "ACTIVE") return NextResponse.json({ error: "Turn this bot on before running it.", code: "BOT_NOT_ACTIVE" }, { status: 409 });

  const spec = strategySpec.safeParse(bot.strategy);
  if (!spec.success) return NextResponse.json({ error: "Save a strategy before running this bot." }, { status: 409 });
  if (spec.data.source === "webhook") return NextResponse.json({ error: "Alert bots run when your TradingView alert arrives. Send a test alert to its URL." }, { status: 409 });
  if (spec.data.mode === "live") {
    if (!liveExecutionConfigured()) return NextResponse.json({ error: "Live trading is not enabled on this deployment." }, { status: 503 });
    const managed = await prisma.polymarketManagedAccount.findUnique({ where: { userId: session.user.id }, select: { status: true, liveEnabled: true } });
    if (!managed || managed.status !== "ACTIVE" || !managed.liveEnabled) return NextResponse.json({ error: "Enable live trading on your funded Trading account before running a live Polymarket bot." }, { status: 409 });
  }

  const run = await runRuleBot(bot.id, spec.data, "manual");
  return NextResponse.json(
    { status: run.outcome === "FAILED" ? "ERROR" : "SUCCESS", outcome: run.outcome, message: run.reason, tradeId: run.tradeId ?? null },
    { status: run.outcome === "FAILED" ? 502 : 200 },
  );
}
