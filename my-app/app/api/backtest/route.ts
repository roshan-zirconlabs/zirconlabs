import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { backtestInput } from "@/lib/backtest-input";
import { analyzeBacktest } from "@/lib/backtest";
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const text = await req.text();
  if (text.length > 2000000) return NextResponse.json({ error: "Backtest payload exceeds 2 MB." }, { status: 413 });
  let raw: unknown; try { raw = JSON.parse(text); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const input = backtestInput.safeParse(raw);
  if (!input.success) return NextResponse.json({ error: "Invalid backtest input. Check CSV size, historical data, timeframe and stake." }, { status: 400 });
  const report = analyzeBacktest(input.data);
  const result = await prisma.backtestResult.create({ data: { userId: session.user.id, name: input.data.name, csvHash: createHash("sha256").update(input.data.tradesCsv).digest("hex"), marketType: input.data.marketType, totalTrades: report.summary.trades, winRate: report.summary.winRate, totalPnl: report.summary.totalPnlUsd, maxDrawdown: report.summary.maxDrawdown, summary: JSON.parse(JSON.stringify(report)) } });
  return NextResponse.json({ id: result.id, report }, { status: 201 });
}
export async function GET() {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ results: await prisma.backtestResult.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" }, take: 20 }) });
}
