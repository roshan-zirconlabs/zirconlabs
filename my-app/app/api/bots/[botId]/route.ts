import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { strategySpec } from "@/lib/workflow/strategy";
import { alertUrl } from "@/lib/runner/hosting";

function decorateBot<T extends { id: string; strategy: unknown }>(b: T, origin: string) {
  const spec = strategySpec.safeParse(b.strategy);
  // An alert bot's URL is stable from the moment its strategy is saved, so it
  // can be pasted into TradingView before the bot is switched on.
  return { ...b, webhookUrl: spec.success && spec.data.source === "webhook" ? alertUrl(b.id, origin) : null };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { botId } = await params;
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const bot = await prisma.bot.findFirst({
      where: { id: botId, userId: user.id },
      include: {
        _count: { select: { trades: true } },
        trades: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

    return NextResponse.json(decorateBot(bot, req.nextUrl.origin));
  } catch (err: unknown) {
    console.error("GET /api/bots/[botId] error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to fetch bot" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ botId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { botId } = await params;
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const bot = await prisma.bot.findFirst({
      where: { id: botId, userId: user.id },
    });
    if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

    await prisma.bot.delete({ where: { id: botId } });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("DELETE /api/bots/[botId] error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to delete bot" }, { status: 500 });
  }
}
