import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { strategySpec, describeStrategy } from "@/lib/workflow/strategy";
import { canvasFromStrategy } from "@/lib/workflow/canvas-strategy";
import { alertUrl } from "@/lib/runner/hosting";

type RouteParams = { params: Promise<{ botId: string }> };
const headers = { "Cache-Control": "private, no-store" };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bot = await prisma.bot.findFirst({
    where: { id: (await params).botId, userId: session.user.id },
    select: { id: true, name: true, status: true, strategy: true },
  });
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  const spec = strategySpec.safeParse(bot.strategy);
  return NextResponse.json({
    bot: { id: bot.id, name: bot.name, status: bot.status },
    strategy: spec.success ? spec.data : null,
    summary: spec.success ? describeStrategy(spec.data) : null,
    alertUrl: spec.success && spec.data.source === "webhook" ? alertUrl(bot.id, req.nextUrl.origin) : null,
  }, { headers });
}

/** Saves the strategy. An active bot runs the new version from its next run. */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bot = await prisma.bot.findFirst({ where: { id: (await params).botId, userId: session.user.id } });
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  const raw = await req.json().catch(() => null);
  const parsed = strategySpec.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the strategy settings." }, { status: 400, headers });
  }
  const spec = parsed.data;
  // The canvas can rename the bot while saving its strategy; the guided builder
  // sends no name and leaves it unchanged.
  const rawName = typeof raw === "object" && raw ? (raw as { name?: unknown }).name : undefined;
  const name = typeof rawName === "string" && rawName.trim() ? rawName.trim().slice(0, 100) : undefined;

  if (spec.mode === "live") {
    const account = await prisma.polymarketManagedAccount.findUnique({ where: { userId: session.user.id } });
    if (!account || account.status !== "ACTIVE" || !account.liveEnabled) {
      return NextResponse.json({
        error: "Fund your trading account and turn on live trading before saving a live strategy.",
        code: "LIVE_ACCOUNT_REQUIRED",
      }, { status: 409, headers });
    }
  }

  // The visual editor shows the same strategy as a graph.
  const graph = canvasFromStrategy(spec);
  await prisma.bot.update({
    where: { id: bot.id },
    data: { strategy: spec, workflow: JSON.parse(JSON.stringify(graph)), ...(name ? { name } : {}) },
  });

  return NextResponse.json({ ok: true, strategy: spec, summary: describeStrategy(spec), nodes: graph.nodes.length, republished: bot.status === "ACTIVE" }, { headers });
}
