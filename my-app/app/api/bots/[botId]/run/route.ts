import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { keeperhubForUser } from "@/lib/keeperhub-connection";
import { graphSchema } from "@/lib/workflow-validation";
import { simulateBuy } from "@/lib/paper-fill";
import { z } from "zod";
import { liveExecutionConfigured } from "@/lib/polymarket/managed-account";
import { workflowRunGuard } from "@/lib/bot-run-guard";
import { strategySpec } from "@/lib/workflow/strategy";

const paperOrder = z.object({
  marketSlug: z.string().regex(/^[a-z0-9-]{1,220}$/),
  direction: z.enum(["UP", "DOWN"]).default("UP"),
  sizeUsd: z.coerce.number().positive().max(10000),
  maxPrice: z.coerce.number().positive().max(1),
});
async function remoteJson(url: string) {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error("Live market data unavailable. No fill was recorded.");
  return res.json();
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bot = await prisma.bot.findFirst({ where: { id: (await params).botId, userId: session.user.id } });
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  try {
    if (body.paper !== true) {
      if (body.confirmLive !== true) return NextResponse.json({ error: "Explicit live-run confirmation is required. KeeperHub workflows can spend real funds." }, { status: 400 });
      const workflowId = bot.keeperhubWorkflowId;
      const readiness = workflowRunGuard({ status: bot.status, keeperhubWorkflowId: workflowId });
      if (!readiness.ok) return NextResponse.json({ error: readiness.error, code: "WORKFLOW_NOT_ACTIVE" }, { status: 409 });
      if (!workflowId) return NextResponse.json({ error: "This bot is not published or active. Open the editor, save the workflow, then choose Publish & activate.", code: "WORKFLOW_NOT_ACTIVE" }, { status: 409 });
      // Gate on the bot's declared mode, not on text found in the graph: every
      // compiled workflow mentions Polymarket, including practice ones.
      const spec = strategySpec.safeParse(bot.strategy);
      const spendsRealMoney = spec.success
        ? spec.data.mode === "live"
        : JSON.stringify(bot.workflow ?? "").toLowerCase().includes("place-order");
      if (spendsRealMoney) {
        if (!liveExecutionConfigured()) return NextResponse.json({ error: "The signed Polymarket CLOB V2 adapter is not enabled on this deployment yet." }, { status: 503 });
        const managed = await prisma.polymarketManagedAccount.findUnique({ where: { userId: session.user.id }, select: { status: true, liveEnabled: true } });
        if (!managed || managed.status !== "ACTIVE" || !managed.liveEnabled) return NextResponse.json({ error: "Enable live trading on your funded Trading account before running a live Polymarket bot." }, { status: 409 });
      }
      const { client: kh } = await keeperhubForUser(session.user.id);
      const execution = await kh.executeWorkflow(workflowId, { source: "zircon-labs", botId: bot.id });
      return NextResponse.json(execution, { status: 202 });
    }
    const graph = graphSchema.safeParse(bot.workflow);
    const orderNodes = graph.success ? graph.data.nodes.filter(n => String(n.data.config.actionType).endsWith("place-order")) : [];
    const parsed = paperOrder.safeParse(body.order ?? (orderNodes.length === 1 ? orderNodes[0].data.config : null));
    if (!parsed.success) return NextResponse.json({ error: "Choose a market slug, direction, stake and maximum price for a paper quote. No default market is used." }, { status: 400 });
    const order = parsed.data;
    const market = await remoteJson(`https://gamma-api.polymarket.com/markets/slug/${encodeURIComponent(order.marketSlug)}`);
    if (market.closed || market.active !== true || market.acceptingOrders !== true) throw new Error("This market is not accepting orders.");
    const outcomes: string[] = typeof market.outcomes === "string" ? JSON.parse(market.outcomes) : market.outcomes;
    const tokens: string[] = typeof market.clobTokenIds === "string" ? JSON.parse(market.clobTokenIds) : market.clobTokenIds;
    const aliases = order.direction === "UP" ? ["up", "yes"] : ["down", "no"];
    const index = Array.isArray(outcomes) ? outcomes.findIndex(o => aliases.includes(o.toLowerCase())) : -1;
    const tokenId = tokens?.[index];
    if (index < 0 || !/^\d+$/.test(tokenId ?? "")) throw new Error("The selected market does not have the requested binary outcome.");
    const book = await remoteJson(`https://clob.polymarket.com/book?token_id=${tokenId}`);
    const asks = z.array(z.object({ price: z.string(), size: z.string() })).parse(book.asks);
    const fill = simulateBuy(asks, order.sizeUsd, order.maxPrice);
    const trade = await prisma.trade.create({ data: {
      userId: session.user.id, botId: bot.id, signal: "BUY", side: "BUY", direction: order.direction,
      marketSlug: order.marketSlug, tokenId, ...fill, status: "FILLED", executedAt: new Date(), paper: true,
    } });
    return NextResponse.json({ id: trade.id, executionId: trade.id, status: "SUCCESS", paper: true,
      marketSlug: order.marketSlug, ...fill, startedAt: trade.executedAt, message: "Quote-time paper fill. Excludes fees, queue position and settlement. No real order was placed." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Execution failed. No success receipt was generated." }, { status: 502 });
  }
}
