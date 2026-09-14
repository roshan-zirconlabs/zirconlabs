import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { keeperhubForUser } from "@/lib/keeperhub-connection";
import { prisma } from "@/lib/prisma";
export async function GET(_req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bot = await prisma.bot.findFirst({ where: { id: (await params).botId, userId: session.user.id } });
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  const trades = await prisma.trade.findMany({ where: { botId: bot.id }, take: 50, orderBy: { createdAt: "desc" } });
  const executions: Record<string, unknown>[] = trades.map(t => ({
    id: t.id, executionId: t.id,
    status: t.status === "FAILED" ? "FAILED" : t.status === "CANCELLED" ? "CANCELLED" : ["FILLED", "CLOSED"].includes(t.status) ? "SUCCESS" : "PENDING",
    startedAt: (t.executedAt || t.createdAt).toISOString(), paper: t.paper,
    marketSlug: t.marketSlug, side: t.side, amount: t.amount, price: t.price,
    source: t.paper ? "paper-quote" : "reported-trade",
    // An order ID is not a transaction hash; never turn it into an explorer link.
  }));
  let warning: string | undefined;
  if (bot.keeperhubWorkflowId && !bot.keeperhubWorkflowId.startsWith("local_")) {
    try {
      const remote = await (await keeperhubForUser(session.user.id)).getExecutions(bot.keeperhubWorkflowId);
      executions.push(...remote.map(e => ({ ...e, source: "keeperhub" })));
    } catch { warning = "KeeperHub execution history is unavailable. Local trade records are shown; refresh after reconnecting."; }
  }
  executions.sort((a, b) => Date.parse(String(b.startedAt ?? "")) - Date.parse(String(a.startedAt ?? "")));
  return NextResponse.json({ executions, warning });
}
