import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { keeperhub } from "@/lib/keeperhub";
import { keeperhubForUser } from "@/lib/keeperhub-connection";

function decorateBot<T extends { keeperhubWorkflowId: string | null }>(b: T) {
  return {
    ...b,
    editorUrl: b.keeperhubWorkflowId
      ? keeperhub.editorUrl(b.keeperhubWorkflowId)
      : null,
    webhookUrl: b.keeperhubWorkflowId
      ? keeperhub.webhookUrl(b.keeperhubWorkflowId)
      : null,
  };
}

export async function GET(
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
      include: {
        _count: { select: { trades: true } },
        trades: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

    return NextResponse.json(decorateBot(bot));
  } catch (err: any) {
    console.error("GET /api/bots/[botId] error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch bot" }, { status: 500 });
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

    if (bot.keeperhubWorkflowId && !bot.keeperhubWorkflowId.startsWith("local_")) {
      await (await keeperhubForUser(user.id)).deleteWorkflow(bot.keeperhubWorkflowId);
    }

    await prisma.bot.delete({ where: { id: botId } });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/bots/[botId] error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete bot" }, { status: 500 });
  }
}
