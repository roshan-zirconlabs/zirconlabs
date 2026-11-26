import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyBotHookToken } from "@/lib/workflow/bot-token";
import { runAlert } from "@/lib/runner/run";
import { alertActionFrom } from "@/lib/runner/alert";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "no-store" };

/** A bot's public alert URL, for TradingView or any other signal source. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ botId: string; token: string }> }) {
  const { botId, token } = await params;
  if (!verifyBotHookToken(botId, token)) return NextResponse.json({ error: "Unknown alert URL." }, { status: 404, headers });

  const bot = await prisma.bot.findUnique({ where: { id: botId }, select: { status: true } });
  if (!bot) return NextResponse.json({ error: "Unknown alert URL." }, { status: 404, headers });
  if (bot.status !== "ACTIVE") return NextResponse.json({ error: "This bot is paused. Activate it to act on alerts." }, { status: 409, headers });

  const raw = (await req.text().catch(() => "")).slice(0, 4000);
  const action = alertActionFrom(raw);
  if (!action) {
    return NextResponse.json({ error: 'The alert did not name a direction. Send "buy" or "sell", or JSON like {"action": "buy"}.' }, { status: 400, headers });
  }
  const { result } = await runAlert(botId, action);
  return NextResponse.json(result.body, { status: result.status, headers });
}
